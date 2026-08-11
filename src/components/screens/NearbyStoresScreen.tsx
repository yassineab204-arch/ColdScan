import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation as NavigationIcon,
  Search,
  LocateFixed,
  Store,
  ShoppingBag,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Crosshair,
  Filter,
  ChevronDown,
  Map as MapIcon,
  List,
  X,
} from 'lucide-react';
import { ShoppingItem, Recipe, FoodItem, LanguageType } from '../../types';
import { t, getLocalizedFoodItemName, getLocalizedCategory } from '../../utils/i18n';
import { apiFetch } from '../../utils/api';

interface NearbyStoresScreenProps {
  shoppingList: ShoppingItem[];
  inventory: FoodItem[];
  recipes: Recipe[];
  language?: LanguageType;
  currency?: string;
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------
type LatLng = { lat: number; lon: number };
type LocationSource = 'device' | 'search';

interface StoreProviderElement {
  id?: string | number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface NearbyStore {
  id: string;
  name: string;
  lat: number;
  lon: number;
  shop: string; // supermarket, grocery, convenience, bakery, etc.
  amenity?: string;
  address?: string;
  distanceMeters: number;
  tags: Record<string, string>;
  categoriesCovered: string[]; // human categories like Produce, Dairy & Eggs etc.
  isFeaturedMarket: boolean;
}

const FEATURED_MARKET_PATTERN = /\b(carrefour|bim|supeco|marjane|aswak assalam|atacadao|kazyon|acima)\b/i;

function isFeaturedMarket(tags: Record<string, string>, name: string): boolean {
  return FEATURED_MARKET_PATTERN.test(
    [name, tags.brand, tags.operator, tags.banner].filter(Boolean).join(' ')
  );
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function formatStoreDistance(
  meters: number,
  source: LocationSource | null,
  lang: LanguageType
): string {
  return t(source === 'device' ? 'mapDistanceFromYou' : 'mapDistanceFromArea', lang).replace(
    '__distance__',
    formatDistance(meters)
  );
}

function shopToCategories(shop: string, amenity?: string): string[] {
  const s = (shop || amenity || '').toLowerCase();
  if (['supermarket', 'grocery', 'convenience', 'general', 'marketplace', 'supermarche', 'wholesale'].includes(s)) {
    return ['Produce', 'Dairy & Eggs', 'Proteins', 'Condiments & Sauces', 'Beverages', 'Bakery', 'Pantry & Other'];
  }
  if (s === 'greengrocer' || s === 'farm' || s === 'fruit') return ['Produce'];
  if (s === 'bakery' || s === 'pastry') return ['Bakery', 'Pantry & Other'];
  if (s === 'butcher' || s === 'meat' || s === 'seafood') return ['Proteins'];
  if (s === 'deli' || s === 'cheese') return ['Dairy & Eggs', 'Proteins', 'Condiments & Sauces'];
  if (s === 'beverages' || s === 'alcohol') return ['Beverages'];
  if (s === 'dairy') return ['Dairy & Eggs'];
  return ['Pantry & Other', 'Produce'];
}

function shopLabel(shop: string, amenity?: string, lang: LanguageType = 'en'): string {
  const key = (shop || amenity || 'shop').toLowerCase();
  const map: Record<string, Record<LanguageType, string>> = {
    supermarket: { en: 'Supermarket', fr: 'Supermarché', 'ar-MA': 'سوبيرمارشي', ar: 'سوبرماركت', es: 'Supermercado', de: 'Supermarkt', it: 'Supermercato', pt: 'Supermercado', ja: 'スーパー' },
    grocery: { en: 'Grocery', fr: 'Épicerie', 'ar-MA': 'بقال', ar: 'بقالة', es: 'Tienda', de: 'Lebensmittel', it: 'Alimentari', pt: 'Mercearia', ja: '食料品店' },
    convenience: { en: 'Convenience', fr: 'Supérette', 'ar-MA': 'حانوت', ar: 'متجر صغير', es: 'Tienda 24h', de: 'Kiosk', it: 'Minimarket', pt: 'Minimercado', ja: 'コンビニ' },
    bakery: { en: 'Bakery', fr: 'Boulangerie', 'ar-MA': 'مخبزة', ar: 'مخبز', es: 'Panadería', de: 'Bäckerei', it: 'Panetteria', pt: 'Padaria', ja: 'パン屋' },
    butcher: { en: 'Butcher', fr: 'Boucherie', 'ar-MA': 'جزار', ar: 'جزارة', es: 'Carnicería', de: 'Metzgerei', it: 'Macelleria', pt: 'Talhos', ja: '肉屋' },
    greengrocer: { en: 'Greengrocer', fr: 'Primeur', 'ar-MA': 'خضار', ar: 'خضار', es: 'Verdulería', de: 'Gemüsehändler', it: 'Fruttivendolo', pt: 'Frutaria', ja: '八百屋' },
    marketplace: { en: 'Market', fr: 'Marché', 'ar-MA': 'سوق', ar: 'سوق', es: 'Mercado', de: 'Markt', it: 'Mercato', pt: 'Mercado', ja: '市場' },
    general: { en: 'General store', fr: 'Épicerie générale', 'ar-MA': 'حانوت عام', ar: 'متجر عام', es: 'Tienda general', de: 'Gemischtwaren', it: 'Emporio', pt: 'Loja geral', ja: '雑貨店' },
  };
  return map[key]?.[lang] || map[key]?.en || (shop ? shop[0].toUpperCase() + shop.slice(1) : 'Store');
}

function openDirections(lat: number, lon: number, _label?: string) {
  // With no origin in the URL, Google Maps uses the device's current location.
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking&dir_action=navigate`,
    '_blank',
    'noopener,noreferrer'
  );
}

function openInOSM(lat: number, lon: number) {
  window.open(
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
    '_blank',
    'noopener,noreferrer'
  );
}

function openNearbySearch({ lat, lon }: LatLng) {
  window.open(
    `https://www.google.com/maps/search/grocery/@${lat},${lon},14z`,
    '_blank',
    'noopener,noreferrer'
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

// --------------------------------------------------------
// Component
// --------------------------------------------------------
export const NearbyStoresScreen: React.FC<NearbyStoresScreenProps> = ({
  shoppingList,
  inventory,
  recipes,
  language = 'en',
  currency = 'DH',
}) => {
  const lang = (language || 'en') as LanguageType;

  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [positionAccuracy, setPositionAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'searching' | 'ready' | 'error' | 'denied'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [radius, setRadius] = useState<number>(2500);
  const [manualQuery, setManualQuery] = useState('');
  const [searchingManual, setSearchingManual] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [ingredientFilter, setIngredientFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const locationRequestRef = useRef(0);
  const storesAbortRef = useRef<AbortController | null>(null);

  // Ingredients you need: combine shopping list + missing from recipes (unique)
  const neededIngredients = useMemo(() => {
    const map = new Map<string, ShoppingItem>();
    shoppingList.filter(s => !s.isBought).forEach(s => map.set(s.name.toLowerCase(), s));
    recipes.forEach(r => {
      r.ingredientsMissing.forEach(m => {
        const key = m.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: `missing-${key}`,
            name: m,
            category: 'Pantry & Other',
            quantity: 1,
            unit: 'item',
            estimatedPrice: 0,
            isBought: false,
            priority: 'medium',
            relatedRecipe: r.name,
          });
        }
      });
    });
    return Array.from(map.values()).slice(0, 24);
  }, [shoppingList, recipes]);

  const neededCategoryOf = (name: string): string => {
    const found = neededIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    return found?.category || 'Pantry & Other';
  };

  // Recalculate from the latest device fix (or manually searched point) instead
  // of keeping the distance from the original response. This corrects values
  // immediately when the browser refines a coarse location.
  const storesByDistance = useMemo(() => {
    if (!userPos) return stores;
    return stores
      .map((store) => ({
        ...store,
        distanceMeters: Math.round(haversine(userPos, { lat: store.lat, lon: store.lon })),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [stores, userPos]);

  // Filter stores by ingredient category
  const filteredStores = useMemo(() => {
    if (ingredientFilter === 'all') return storesByDistance;
    const cat = neededCategoryOf(ingredientFilter);
    return storesByDistance.filter(s => s.categoriesCovered.includes(cat) || s.categoriesCovered.includes('Pantry & Other') && cat === 'Pantry & Other' || s.shop === 'supermarket' || s.shop === 'grocery');
  }, [storesByDistance, ingredientFilter, neededIngredients]);

  const selectedStore = filteredStores.find(s => s.id === selectedStoreId) || null;

  // ---------------- Geolocation ----------------
  const requestLocation = () => {
    const requestId = ++locationRequestRef.current;
    const hadUsableLocation = Boolean(userPos);
    storesAbortRef.current?.abort();

    setStatus('locating');
    setErrorMsg(null);

    const failLocation = (permissionDenied: boolean) => {
      if (requestId !== locationRequestRef.current) return;
      setStatus(hadUsableLocation ? 'ready' : permissionDenied ? 'denied' : 'error');
      setErrorMsg(t(permissionDenied ? 'mapPermissionDenied' : 'mapLocationUnavailable', lang));
    };

    if (!window.isSecureContext) {
      setStatus(hadUsableLocation ? 'ready' : 'error');
      setErrorMsg(t('mapHttpsRequired', lang));
      return;
    }

    if (!navigator.geolocation) {
      failLocation(false);
      return;
    }

    const acceptLocation = (position: GeolocationPosition) => {
      if (requestId !== locationRequestRef.current) return;
      const nextPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      if (!Number.isFinite(nextPosition.lat) || !Number.isFinite(nextPosition.lon)) {
        failLocation(false);
        return;
      }

      setUserPos(nextPosition);
      setLocationSource('device');
      setPositionAccuracy(
        Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null
      );
      setManualQuery('');
      void fetchStores(nextPosition, radius);
    };

    try {
      // Get a normal fix first because it is much faster and more reliable on
      // laptops. If its accuracy is broad, quietly ask the device for a GPS
      // refinement without making the user wait on a blank map.
      navigator.geolocation.getCurrentPosition(
        (position) => {
          acceptLocation(position);
          if (position.coords.accuracy <= 50) return;

          navigator.geolocation.getCurrentPosition(
            (refinedPosition) => {
              if (requestId !== locationRequestRef.current) return;
              if (refinedPosition.coords.accuracy >= position.coords.accuracy) return;

              const initial = { lat: position.coords.latitude, lon: position.coords.longitude };
              const refined = {
                lat: refinedPosition.coords.latitude,
                lon: refinedPosition.coords.longitude,
              };
              setUserPos(refined);
              setPositionAccuracy(Math.round(refinedPosition.coords.accuracy));

              // A materially different fix needs fresh distances and results.
              if (haversine(initial, refined) > 100) void fetchStores(refined, radius);
            },
            () => undefined,
            { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
          );
        },
        (error) => failLocation(error.code === 1),
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 }
      );
    } catch {
      failLocation(false);
    }
  };

  useEffect(() => {
    requestLocation();
    return () => {
      locationRequestRef.current += 1;
      storesAbortRef.current?.abort();
    };
    // request once when this screen is mounted; the button can request again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when radius changes and we have a position
  useEffect(() => {
    if (userPos) fetchStores(userPos, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  // Manual area search is a fallback when device location is unavailable.
  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = manualQuery.trim();
    if (!query) return;

    const requestId = ++locationRequestRef.current;
    storesAbortRef.current?.abort();
    setSearchingManual(true);
    setErrorMsg(null);
    try {
      const response = await apiFetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language: lang }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        location?: LatLng & { label?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Location search failed');
      if (requestId !== locationRequestRef.current) return;
      if (!data.location) {
        setErrorMsg(
          lang === 'fr' ? 'Aucun lieu trouvé.' : lang === 'ar-MA' ? 'لم يتم العثور على مكان.' : 'No place found.'
        );
        return;
      }

      const nextPosition = { lat: data.location.lat, lon: data.location.lon };
      setUserPos(nextPosition);
      setLocationSource('search');
      setPositionAccuracy(null);
      await fetchStores(nextPosition, radius);
    } catch (error) {
      console.error('Location search failed', error);
      if (requestId === locationRequestRef.current) {
        setErrorMsg(lang === 'fr' ? 'La recherche a échoué. Réessayez.' : 'Search failed. Try again.');
        if (!userPos) setStatus('error');
      }
    } finally {
      setSearchingManual(false);
    }
  };

  // ---------------- Fetch real stores through our same-origin API ----------------
  const fetchStores = async (center: LatLng, rad: number) => {
    storesAbortRef.current?.abort();
    const controller = new AbortController();
    storesAbortRef.current = controller;

    setStatus('searching');
    setErrorMsg(null);
    setStores([]);
    setSelectedStoreId(null);

    try {
      const response = await apiFetch('/api/nearby-stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: center.lat, lon: center.lon, radius: rad }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        success?: boolean;
        elements?: StoreProviderElement[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || `Store search returned ${response.status}`);
      if (controller.signal.aborted) return;

      const elements = Array.isArray(data.elements) ? data.elements : [];
      const parsed = elements
        .map((element): NearbyStore | null => {
          const storeLat = Number(element.lat ?? element.center?.lat);
          const storeLon = Number(element.lon ?? element.center?.lon);
          if (!Number.isFinite(storeLat) || !Number.isFinite(storeLon)) return null;

          const tags = element.tags && typeof element.tags === 'object' ? element.tags : {};
          const street = tags['addr:street'] || '';
          const knownName = tags.name || tags.brand || tags.operator || '';
          const featuredMarket = isFeaturedMarket(tags, knownName);
          // Some chain branches are missing a shop tag in OSM. Their verified
          // brand/name still identifies them as a supermarket.
          const shop = (tags.shop || (featuredMarket ? 'supermarket' : tags.amenity) || 'shop').toLowerCase();
          const displayName = knownName || `${shopLabel(shop, tags.amenity, lang)}${street ? ` · ${street}` : ''}`;
          const addressParts = [street, tags['addr:housenumber'], tags['addr:city']].filter(Boolean);
          const address = addressParts.join(', ') || tags['addr:full'] || tags['addr:place'] || undefined;

          return {
            id: `${element.type || 'place'}-${String(element.id ?? `${storeLat}-${storeLon}`)}`,
            name: displayName,
            lat: storeLat,
            lon: storeLon,
            shop,
            amenity: tags.amenity,
            address,
            distanceMeters: Math.round(haversine(center, { lat: storeLat, lon: storeLon })),
            tags,
            categoriesCovered: shopToCategories(shop, tags.amenity),
            isFeaturedMarket: featuredMarket,
          };
        })
        .filter((store): store is NearbyStore => store !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      // Keep the map readable while guaranteeing that requested chains are not
      // dropped when an area contains more than 80 small shops.
      const featured = parsed.filter((store) => store.isFeaturedMarket);
      const visibleStores = Array.from(
        new Map([...featured, ...parsed].map((store) => [store.id, store])).values()
      )
        .slice(0, 80)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      setStores(visibleStores);
      setSelectedStoreId(visibleStores[0]?.id || null);
      setStatus('ready');
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Nearby store search failed', error);
      setStores([]);
      setSelectedStoreId(null);
      setStatus('error');
      setErrorMsg(t('mapStoreLoadError', lang));
    } finally {
      if (storesAbortRef.current === controller) storesAbortRef.current = null;
    }
  };

  // ---------------- Leaflet Map ----------------
  useEffect(() => {
    if (!mapRef.current || !userPos) return;

    // Clean previous map
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {}
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([userPos.lat, userPos.lon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // zoom control bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // slight delay to ensure tiles load then invalidate
    const invalidateTimeout = window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      window.clearTimeout(invalidateTimeout);
      try { map.remove(); } catch {}
      mapInstanceRef.current = null;
    };
  }, [userPos]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapInstanceRef.current) return;
    const timeout = window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
    return () => window.clearTimeout(timeout);
  }, [viewMode]);

  // Update markers when filteredStores or userPos or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer || !userPos) return;

    layer.clearLayers();

    // User marker
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative; width:22px; height:22px;">
        <div style="position:absolute; inset:0; background:#0B3D2E; border:3px solid white; border-radius:999px; box-shadow:0 4px 16px rgba(11,61,46,0.45)"></div>
        <div style="position:absolute; inset:-8px; border:2px solid #22c55e; border-radius:999px; opacity:0.35;"></div>
        <div style="position:absolute; left:50%; top:50%; width:8px; height:8px; background:white; border-radius:999px; transform:translate(-50%,-50%)"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker([userPos.lat, userPos.lon], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(layer)
      .bindPopup(
        `<div style="font-family:Inter,sans-serif; font-size:12px; font-weight:700; color:#0B3D2E;">${escapeHtml(
          t(locationSource === 'device' ? 'mapCurrentLocation' : 'mapSearchedArea', lang)
        )}</div>`
      );

    // Show the accuracy reported by the device, not an invented search circle.
    if (locationSource === 'device' && positionAccuracy !== null) {
      L.circle([userPos.lat, userPos.lon], {
        radius: Math.max(10, Math.min(positionAccuracy, 1000)),
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.08,
        weight: 1,
        opacity: 0.35,
      }).addTo(layer);
    }

    // Store markers
    filteredStores.forEach((store) => {
      const isSelected = store.id === selectedStoreId;
      const isBig = store.shop === 'supermarket';
      const bg = isSelected ? '#0B3D2E' : isBig ? '#16a34a' : '#ffffff';
      const border = isSelected ? 'white' : '#0B3D2E';
      const textColor = isSelected || isBig ? 'white' : '#0B3D2E';
      const iconHtml = `
        <div style="
          width:${isBig ? 36 : 32}px; height:${isBig ? 36 : 32}px;
          background:${bg};
          border:2px solid ${isSelected ? '#22c55e' : isBig ? '#0B3D2E' : '#e2e8f0'};
          border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 8px 24px rgba(11,61,46,0.22);
          transform:${isSelected ? 'scale(1.08)' : 'scale(1)'};
          transition: transform 0.15s;
        ">
          <span style="font-size:${isBig ? 15 : 13}px; line-height:1">${isBig ? '🛒' : store.shop === 'bakery' ? '🥖' : store.shop === 'butcher' ? '🥩' : store.shop === 'greengrocer' ? '🥬' : '🏪'}</span>
        </div>
        ${isSelected ? `<div style="position:absolute; left:50%; top:100%; width:10px; height:10px; background:${bg}; border-left:2px solid ${isSelected ? '#22c55e' : '#e2e8f0'}; border-bottom:2px solid ${isSelected ? '#22c55e' : '#e2e8f0'}; transform:translate(-50%,-5px) rotate(45deg);"></div>` : ''}
      `;
      const icon = L.divIcon({
        className: '',
        html: iconHtml,
        iconSize: [isBig ? 36 : 32, isBig ? 36 : 32],
        iconAnchor: [isBig ? 18 : 16, isBig ? 18 : 16],
      });
      const marker = L.marker([store.lat, store.lon], { icon }).addTo(layer);
      marker.on('click', () => {
        setSelectedStoreId(store.id);
        // scroll list into view on mobile?
      });
      const popupHtml = `
        <div style="font-family:Inter,system-ui,sans-serif; min-width:180px;">
          <div style="font-size:13px; font-weight:800; color:#0B3D2E; line-height:1.2;">${escapeHtml(store.name)}</div>
          <div style="font-size:11px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.06em; margin-top:2px;">${escapeHtml(shopLabel(store.shop, store.amenity, lang))} · ${escapeHtml(formatStoreDistance(store.distanceMeters, locationSource, lang))}</div>
          ${store.isFeaturedMarket ? `<div style="display:inline-block; font-size:9px; font-weight:800; color:#0B3D2E; background:#dcfce7; padding:2px 6px; border-radius:999px; margin-top:5px;">${escapeHtml(t('mapChainMarket', lang))}</div>` : ''}
          ${store.address ? `<div style="font-size:11px; color:#475569; margin-top:4px;">${escapeHtml(store.address)}</div>` : ''}
          <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">
            ${store.categoriesCovered.slice(0,3).map(c => `<span style="font-size:10px; font-weight:800; background:#e8f7ef; color:#0B3D2E; border:1px solid #bbf7d0; padding:2px 6px; border-radius:999px;">${getLocalizedCategory(c, lang)}</span>`).join('')}
          </div>
          <button data-dir="${store.id}" style="margin-top:8px; width:100%; background:#0B3D2E; color:#86efac; font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; padding:7px 10px; border-radius:10px; border:none; cursor:pointer;">${lang==='fr'?'Itinéraire': lang==='ar-MA'?'الاتجاهات':'Directions'}</button>
        </div>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 240, className: 'coldscan-popup' });
      marker.on('popupopen', () => {
        // wire button inside popup
        setTimeout(() => {
          const btn = document.querySelector(`button[data-dir="${store.id}"]`);
          if (btn) btn.addEventListener('click', () => openDirections(store.lat, store.lon, store.name));
        }, 50);
      });
    });

    // Fit bounds if we have stores
    if (filteredStores.length > 0) {
      const bounds = L.latLngBounds(
        [[userPos.lat, userPos.lon], ...filteredStores.map(s => [s.lat, s.lon] as [number, number])]
      );
      map.fitBounds(bounds.pad(0.18), { maxZoom: 15, animate: true });
    } else {
      map.setView([userPos.lat, userPos.lon], 14);
    }
  }, [filteredStores, userPos, selectedStoreId, lang, locationSource, positionAccuracy]);

  // When selected store changes, pan map
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStore) return;
    mapInstanceRef.current.panTo([selectedStore.lat, selectedStore.lon], { animate: true });
  }, [selectedStoreId]);

  const unboughtCount = shoppingList.filter(s => !s.isBought).length;
  const isLocating = status === 'locating';
  const isLoading = isLocating || status === 'searching';

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-pine ring-1 ring-cold/20">
                <MapPin className="w-3 h-3 text-cold-dark" />
                {lang === 'fr' ? 'Magasins proches' : lang === 'ar-MA' ? 'محلات قريبة' : lang === 'ja' ? '近くの店舗' : 'Nearby stores'}
              </span>
              {unboughtCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900 ring-1 ring-amber-200">
                  <ShoppingBag className="w-3 h-3" />
                  {unboughtCount} {lang === 'fr' ? 'à acheter' : lang === 'ar-MA' ? 'للشراء' : 'to buy'}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
              {lang === 'fr' ? 'Où acheter ce qui vous manque' : lang === 'ar-MA' ? 'فين تشري اللي ناقصك' : lang === 'es' ? 'Dónde comprar lo que te falta' : lang === 'ja' ? '足りないものを買える場所' : 'Where to buy what you need'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 leading-relaxed">
              {neededIngredients.length === 0
                ? lang === 'fr'
                  ? 'Votre liste est vide — nous montrons les commerces alimentaires autour de vous.'
                  : lang === 'ar-MA'
                  ? 'السويقة خاوية — كنورو أقرب المحلات ليك.'
                  : 'Your list is empty — showing grocery stores around you.'
                : lang === 'fr'
                ? `Basé sur ${neededIngredients.length} ingrédients manquants · carte centrée sur vous.`
                : lang === 'ar-MA'
                ? `مبني على ${neededIngredients.length} حوايج ناقصين · الخريطة مركزة عليك.`
                : `Based on ${neededIngredients.length} missing ingredients · map centered on you.`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={requestLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-2 rounded-full bg-pine px-4 py-2.5 text-xs font-black uppercase tracking-widest text-cold hover:bg-pine-light transition-colors shadow-sm disabled:cursor-wait disabled:opacity-70"
            >
              {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {t('mapUseCurrentLocation', lang)}
            </button>
          </div>
        </div>

        {/* Search + Radius */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder={lang === 'fr' ? 'Chercher une ville, ex: Casablanca, Marrakech…' : lang === 'ar-MA' ? 'قلب على مدينة، مثلا: الدار البيضاء…' : 'Search a city, e.g. Casablanca, Marrakech, Paris…'}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cold focus:border-cold"
              />
            </div>
            <button
              type="submit"
              disabled={searchingManual || !manualQuery.trim()}
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {searchingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              {lang === 'fr' ? 'Chercher' : 'Search'}
            </button>
          </form>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
            {[
              { v: 1000, l: '1 km' },
              { v: 2500, l: '2.5 km' },
              { v: 5000, l: '5 km' },
              { v: 10000, l: '10 km' },
            ].map((r) => (
              <button
                key={r.v}
                onClick={() => setRadius(r.v)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors ${radius === r.v ? 'bg-pine text-cold shadow' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {r.l}
              </button>
            ))}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <LocateFixed className="h-3.5 w-3.5 text-cold-dark" />
          {t('mapLocationPrivacy', lang)}
        </p>

        {/* Ingredient filter chips */}
        {neededIngredients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                {lang === 'fr' ? 'Filtrer par ingrédient' : lang === 'ar-MA' ? 'فلتر حسب المكون' : 'Filter by ingredient needed'}
                <span className="hidden sm:inline text-slate-400 font-bold normal-case tracking-normal ml-1">
                  {ingredientFilter === 'all'
                    ? `· ${lang === 'fr' ? 'tous les magasins' : 'all stores'}`
                    : `· ${getLocalizedFoodItemName(ingredientFilter, lang)}`}
                </span>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden inline-flex items-center gap-1 text-xs font-bold text-cold-dark"
              >
                {showFilters ? 'Hide' : 'Show'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className={`${showFilters ? 'flex' : 'hidden sm:flex'} flex-wrap gap-1.5`}>
              <button
                onClick={() => setIngredientFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${ingredientFilter === 'all' ? 'bg-pine text-cold border-pine' : 'bg-white text-slate-700 border-slate-200 hover:border-cold'}`}
              >
                {lang === 'fr' ? 'Tous' : lang === 'ar-MA' ? 'الكل' : 'All'}
              </button>
              {neededIngredients.slice(0, 10).map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => setIngredientFilter(ingredientFilter === ing.name ? 'all' : ing.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${ingredientFilter === ing.name ? 'bg-cold text-pine-deep border-cold' : 'bg-white text-slate-700 border-slate-200 hover:border-cold'}`}
                  title={`${getLocalizedCategory(ing.category, lang)}`}
                >
                  <span>{getLocalizedFoodItemName(ing.name, lang)}</span>
                  <span className="text-[10px] opacity-60 hidden sm:inline">· {getLocalizedCategory(ing.category, lang)}</span>
                </button>
              ))}
              {neededIngredients.length > 10 && (
                <span className="px-2 py-1.5 text-xs font-bold text-slate-400">+{neededIngredients.length - 10} more</span>
              )}
            </div>
          </div>
        )}

        {/* Status bar */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-amber-900 leading-relaxed">{errorMsg}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!userPos ? (
                  <button onClick={requestLocation} className="rounded-full bg-pine px-3 py-1.5 text-[11px] font-black text-cold">
                    {t('mapTryAgain', lang)}
                  </button>
                ) : status === 'error' ? (
                  <>
                    <button onClick={() => void fetchStores(userPos, radius)} className="rounded-full bg-pine px-3 py-1.5 text-[11px] font-black text-cold">
                      {t('mapTryAgain', lang)}
                    </button>
                    <button onClick={() => openNearbySearch(userPos)} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-amber-900 ring-1 ring-amber-300">
                      {t('mapOpenExternal', lang)}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {userPos && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint border border-cold/20 px-2.5 py-1 font-black text-pine text-[11px]">
              <LocateFixed className="w-3 h-3 text-cold-dark" />
              {t(locationSource === 'device' ? 'mapCurrentLocation' : 'mapSearchedArea', lang)}
              {locationSource === 'device' && positionAccuracy !== null && (
                <span className="font-bold text-pine/65">· ±{formatDistance(positionAccuracy)}</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 font-bold text-slate-700 text-[11px]">
              <Store className="w-3 h-3 text-cold-dark" />
              {filteredStores.length} {lang === 'fr' ? 'magasins' : lang === 'ar-MA' ? 'محل' : 'stores'} · {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
            </span>
            <button onClick={() => openInOSM(userPos.lat, userPos.lon)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-cold-dark hover:bg-mint">
              OSM <ExternalLink className="w-3 h-3" />
            </button>
            <p className="basis-full text-[11px] font-medium leading-relaxed text-slate-500">
              {t('mapDistanceNote', lang)}
            </p>
          </div>
        )}
      </div>

      {/* Map + List layout */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_0.85fr] items-start">
        {/* Map Card */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          {/* Map header toggles */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
              <MapIcon className="w-4 h-4 text-cold-dark" />
              {lang === 'fr' ? 'Carte' : lang === 'ar-MA' ? 'الخريطة' : 'Map'}
              <span className="hidden sm:inline-flex items-center gap-1 ml-2 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal">
                <span className="w-2 h-2 rounded-full bg-cold animate-pulse" />
                OpenStreetMap · Overpass
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 p-1 bg-white rounded-full border border-slate-200">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${viewMode === 'map' ? 'bg-pine text-cold' : 'text-slate-600'}`}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${viewMode === 'list' ? 'bg-pine text-cold' : 'text-slate-600'}`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
          </div>

          {/* Map container - always mounted but hidden when viewMode list on mobile? keep mounted for leaflet */}
          <div className={`${viewMode === 'list' ? 'hidden lg:block' : 'block'} relative`}>
            <div ref={mapRef} className="w-full h-[380px] sm:h-[460px] lg:h-[520px] bg-[#e8f0e8]" />

            {/* Overlay loading */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-pine text-cold flex items-center justify-center shadow-lg">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-sm font-black text-pine tracking-tight">
                  {status === 'locating' ? (lang === 'fr' ? 'Localisation…' : 'Locating…') : lang === 'fr' ? 'Recherche de magasins…' : 'Finding stores…'}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  {lang === 'fr' ? `Rayon ${radius / 1000} km` : `Radius ${radius / 1000} km`}
                </p>
              </div>
            )}

            {/* Location permission gate. We never substitute a fake city. */}
            {!isLoading && !userPos && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-mint text-pine flex items-center justify-center ring-1 ring-cold/20">
                  <LocateFixed className="w-7 h-7" />
                </div>
                <h3 className="mt-3 font-black text-slate-900">{t('mapLocationNeeded', lang)}</h3>
                <p className="mt-1 text-sm text-slate-600 max-w-sm">{t('mapLocationNeededDesc', lang)}</p>
                <button onClick={requestLocation} className="mt-4 inline-flex items-center gap-2 rounded-full bg-pine px-4 py-2.5 text-xs font-black uppercase tracking-wider text-cold">
                  <LocateFixed className="h-4 w-4" /> {t('mapUseCurrentLocation', lang)}
                </button>
              </div>
            )}

            {/* Empty overlay */}
            {status === 'ready' && filteredStores.length === 0 && userPos && (
              <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Store className="w-7 h-7" />
                </div>
                <h3 className="mt-3 font-black text-slate-900">
                  {lang === 'fr' ? 'Aucun magasin trouvé' : lang === 'ar-MA' ? 'ما لقينا حتى محل' : 'No stores found'}
                </h3>
                <p className="mt-1 text-sm text-slate-600 max-w-sm">
                  {lang === 'fr'
                    ? 'Essayez un rayon plus large ou cherchez une autre ville.'
                    : lang === 'ar-MA'
                    ? 'جرب تكبر نطاق البحث أو قلب على مدينة أخرى.'
                    : 'Try a larger radius or search another area.'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {radius < 10000 && (
                    <button onClick={() => setRadius(radius < 5000 ? 5000 : 10000)} className="px-4 py-2 rounded-full bg-pine text-cold font-bold text-xs">
                      {lang === 'fr'
                        ? `Élargir à ${radius < 5000 ? 5 : 10} km`
                        : `Expand to ${radius < 5000 ? 5 : 10} km`}
                    </button>
                  )}
                  <button onClick={() => openNearbySearch(userPos)} className="px-4 py-2 rounded-full bg-white text-pine font-bold text-xs ring-1 ring-slate-200">
                    {t('mapOpenExternal', lang)}
                  </button>
                </div>
              </div>
            )}

            {/* Map legend floating */}
            {userPos && !isLoading && filteredStores.length > 0 && (
              <div className="absolute left-3 bottom-3 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-md px-3 py-2.5 hidden sm:flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <span className="w-3 h-3 rounded-full bg-cold border-2 border-white shadow" /> Supermarket
                </span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <span className="w-3 h-3 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[10px]">🏪</span> Shop
                </span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <span className="w-3 h-3 rounded-full bg-pine border-2 border-white shadow" /> You
                </span>
              </div>
            )}
          </div>

          {/* Mobile list toggle bar */}
          <div className="flex lg:hidden items-center justify-between px-3 py-2.5 border-t border-slate-100 bg-white">
            <span className="text-xs font-bold text-slate-600">
              {filteredStores.length} {lang === 'fr' ? 'résultats' : 'results'} {ingredientFilter !== 'all' && `· ${getLocalizedFoodItemName(ingredientFilter, lang)}`}
            </span>
            <button
              onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              className="inline-flex items-center gap-1.5 rounded-full bg-pine px-3.5 py-1.5 text-xs font-black text-cold"
            >
              {viewMode === 'map' ? <><List className="w-3.5 h-3.5" /> {lang === 'fr' ? 'Voir liste' : 'View list'}</> : <><MapIcon className="w-3.5 h-3.5" /> {lang === 'fr' ? 'Voir carte' : 'View map'}</>}
            </button>
          </div>
        </div>

        {/* Right column: Stores list */}
        <div className={`${viewMode === 'map' ? 'hidden lg:flex' : 'flex'} flex-col gap-3 max-h-[520px] lg:max-h-[540px]`}>
          {/* Header for list column */}
          <div className="bg-white border border-slate-200 rounded-3xl p-3.5 shadow-xs flex items-center justify-between">
            <h3 className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
              <List className="w-4 h-4 text-cold-dark" />
              {lang === 'fr' ? 'Commerces à proximité' : lang === 'ar-MA' ? 'محلات قريبة ليك' : 'Nearby places to buy'}
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              {filteredStores.length} {lang === 'fr' ? 'trouvés' : 'found'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {filteredStores.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-6 text-center">
                <Store className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="mt-2 text-sm font-bold text-slate-700">
                  {lang === 'fr' ? 'Aucun magasin ne correspond au filtre.' : 'No stores match the filter.'}
                </p>
                <button onClick={() => setIngredientFilter('all')} className="mt-3 px-3 py-1.5 rounded-full bg-mint text-pine font-bold text-xs border border-cold/20">
                  {lang === 'fr' ? 'Effacer le filtre' : 'Clear filter'}
                </button>
              </div>
            ) : (
              filteredStores.map((store) => {
                const isSelected = store.id === selectedStoreId;
                const matchingIngredients = neededIngredients.filter(ing =>
                  store.categoriesCovered.includes(ing.category) || store.shop === 'supermarket' || store.shop === 'grocery'
                );
                const canCoverCount = matchingIngredients.length;
                return (
                  <button
                    key={store.id}
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-pine text-white border-pine shadow-md scale-[1.01]'
                        : 'bg-white border-slate-200 hover:border-cold hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className={`min-w-0 truncate text-sm font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {store.name}
                          </div>
                          {store.isFeaturedMarket && (
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${isSelected ? 'bg-cold text-pine-deep' : 'bg-emerald-100 text-emerald-800'}`}>
                              {t('mapChainMarket', lang)}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] font-bold uppercase tracking-widest flex flex-wrap items-center gap-1.5 mt-0.5 ${isSelected ? 'text-cold-soft' : 'text-cold-dark'}`}>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${isSelected ? 'bg-white/15 text-white' : 'bg-mint text-pine border border-cold/20'}`}>
                            {shopLabel(store.shop, store.amenity, lang)}
                          </span>
                          <span className="flex items-center gap-1 normal-case tracking-normal">
                            <NavigationIcon className="w-3 h-3" /> {formatStoreDistance(store.distanceMeters, locationSource, lang)}
                          </span>
                        </div>
                        {store.address && (
                          <div className={`text-xs mt-1 truncate ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                            {store.address}
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm ${isSelected ? 'bg-cold text-pine-deep' : store.shop === 'supermarket' ? 'bg-pine text-cold' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {store.shop === 'supermarket' ? '🛒' : store.shop === 'bakery' ? '🥖' : store.shop === 'butcher' ? '🥩' : store.shop === 'greengrocer' ? '🥬' : '🏪'}
                      </span>
                    </div>

                    {/* What you can buy here */}
                    {neededIngredients.length > 0 && (
                      <div className={`rounded-xl px-2.5 py-2 ${isSelected ? 'bg-white/10' : 'bg-mint/50 border border-cold/10'}`}>
                        <div className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${isSelected ? 'text-cold' : 'text-pine'}`}>
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            {lang === 'fr' ? 'Vous pourrez y trouver' : lang === 'ar-MA' ? 'تقدر تلقى فيه' : 'You can get here'}
                          </span>
                          <span className={`${isSelected ? 'text-white' : 'text-slate-600'}`}>{canCoverCount}/{neededIngredients.length}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {matchingIngredients.slice(0, 4).map(ing => (
                            <span
                              key={ing.id}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${isSelected ? 'bg-white text-pine border-white' : 'bg-white text-slate-800 border-slate-200'}`}
                            >
                              {getLocalizedFoodItemName(ing.name, lang)}
                            </span>
                          ))}
                          {matchingIngredients.length > 4 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              +{matchingIngredients.length - 4}
                            </span>
                          )}
                          {matchingIngredients.length === 0 && (
                            <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                              {lang === 'fr' ? 'Produits généraux' : 'General goods'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openDirections(store.lat, store.lon, store.name);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${isSelected ? 'bg-cold text-pine-deep hover:bg-cold-dark hover:text-white' : 'bg-pine text-cold hover:bg-pine-light'}`}
                      >
                        <NavigationIcon className="w-3.5 h-3.5" />
                        {lang === 'fr' ? 'Itinéraire' : lang === 'ar-MA' ? 'الطريق' : 'Directions'}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openInOSM(store.lat, store.lon);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1 ${isSelected ? 'bg-white/15 text-white border-white/20 hover:bg-white/25' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                      >
                        OSM <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Help card */}
          <div className="bg-gradient-to-br from-pine to-pine-deep rounded-3xl p-4 text-white border border-cold/20 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-cold text-pine-deep flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black leading-tight">
                  {lang === 'fr' ? 'Astuce' : lang === 'ar-MA' ? 'نصيحة' : 'Tip'}
                </h4>
                <p className="text-xs font-medium text-white/80 leading-relaxed mt-1">
                  {lang === 'fr'
                    ? 'Les supermarchés couvrent tous les ingrédients manquants. Primeurs et boucheries sont parfaits pour un seul ingrédient.'
                    : lang === 'ar-MA'
                    ? 'السوبرمارشي فيه كلشي. الخضار والجزار مزيانين إلا بغيت حاجة وحدة.'
                    : 'Supermarkets cover every missing ingredient. Greengrocers & butchers are great for a single-item run.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected store detail sheet (mobile bottom) */}
      {selectedStore && viewMode === 'map' && (
        <div className="lg:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-3 right-3 z-30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_16px_40px_-16px_rgba(11,61,46,0.45)] p-3.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-pine text-cold flex items-center justify-center shrink-0 text-lg">
              {selectedStore.shop === 'supermarket' ? '🛒' : selectedStore.shop === 'bakery' ? '🥖' : selectedStore.shop === 'butcher' ? '🥩' : selectedStore.shop === 'greengrocer' ? '🥬' : '🏪'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 truncate">{selectedStore.name}</div>
              <div className="text-xs font-bold text-cold-dark">{shopLabel(selectedStore.shop, selectedStore.amenity, lang)} · {formatStoreDistance(selectedStore.distanceMeters, locationSource, lang)}</div>
            </div>
            <button onClick={() => openDirections(selectedStore.lat, selectedStore.lon, selectedStore.name)} className="shrink-0 w-10 h-10 rounded-xl bg-cold text-pine-deep flex items-center justify-center">
              <NavigationIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setSelectedStoreId(null)} className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
