const PROFILE_FIELDS = [
  { key: "name", label: "Name", type: "text", placeholder: "Your name" },
  { key: "role", label: "Role", type: "text", placeholder: "Your role" },
  { key: "company", label: "Company", type: "text", placeholder: "Your company" },
  { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+61 4xx xxx xxx" },
];

/** @typedef {"name" | "role" | "company" | "email" | "phone"} ProfileFieldKey */
/** @typedef {import("../types").Profile} Profile */

/**
 * @param {{
 *   profile: Profile,
 *   qrCodeUrl: string,
 *   onProfileChange: import("react").Dispatch<import("react").SetStateAction<Profile>>
 * }} props
 */
export default function QRScreen({ profile, qrCodeUrl, onProfileChange }) {
  return (
    <div className="carousel-screen">
      <section className="identity-card">
        <div>
          <p className="eyebrow">Who am I</p>
        </div>
        <div className="identity-grid">
          <div className="qr-panel">
            {qrCodeUrl ? <img alt="QR code for attendee identity" src={qrCodeUrl} /> : null}
            <p>Show this when someone asks who you are :)</p>
          </div>
          <div className="profile-form">
            {PROFILE_FIELDS.map(({ key, label, type, placeholder }) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={profile[/** @type {ProfileFieldKey} */ (key)]}
                  onChange={(event) =>
                    onProfileChange((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
