import React from 'react';

const INSTAGRAM_URL = 'https://www.instagram.com/cold.scan/';
const BUSINESS_EMAIL = 'yassineab2014@gmail.com';
const MAILTO_LINK = `mailto:${BUSINESS_EMAIL}?subject=ColdScan%20Business%20Inquiry`;

const Settings: React.FC = () => {
  return (
    <div style={{ padding: 16 }}>
      {/* Existing settings above */}

      <section style={{ marginTop: 24 }}>
        <h3>Contact & Links</h3>

        <div style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Instagram — @cold.scan
          </a>
        </div>

        <div style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <a href={MAILTO_LINK}>
            Business Email — {BUSINESS_EMAIL}
          </a>
        </div>
      </section>
    </div>
  );
};

export default Settings;
