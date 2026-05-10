/** @typedef {import("../types").Profile} Profile */
/** @typedef {keyof Profile} ProfileFieldKey */

/** @type {{ key: ProfileFieldKey, label: string, type: string, placeholder: string }[]} */
const PROFILE_FIELDS = [
  { key: "name", label: "Name", type: "text", placeholder: "Your name" },
  { key: "role", label: "Role", type: "text", placeholder: "Your role" },
  { key: "company", label: "Company", type: "text", placeholder: "Your company" },
  { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+61 4xx xxx xxx" },
];

/**
 * Render a QR/profile identity screen that shows a QR code and editable profile fields.
 *
 * Renders a two-column identity card: a QR panel that displays the provided QR image URL (when present)
 * and a profile form with inputs for each field defined in PROFILE_FIELDS. Editing an input invokes
 * `onProfileChange` with an updated profile object.
 *
 * @param {{profile: Profile, qrCodeUrl: string, onProfileChange: import("react").Dispatch<import("react").SetStateAction<Profile>>}} props
 * @param {Profile} props.profile - Current profile values used to populate the form inputs.
 * @param {string} props.qrCodeUrl - URL of the QR code image to display; if empty, no image is rendered.
 * @param {import("react").Dispatch<import("react").SetStateAction<Profile>>} props.onProfileChange - State updater called with a functional update to modify the profile.
 * @returns {JSX.Element} The identity screen element containing the QR panel and profile form.
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
            {qrCodeUrl && <img alt="QR code for attendee identity" src={qrCodeUrl} />}
            <p>Show this when someone asks who you are :)</p>
          </div>
          <div className="profile-form">
            {PROFILE_FIELDS.map(({ key, label, type, placeholder }) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={profile[key]}
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
