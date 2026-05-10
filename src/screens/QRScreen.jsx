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
 * Render a profile card with editable fields and an optional QR code.
 *
 * Renders an identity card showing a "Who am I" eyebrow, a QR panel that displays an image when `qrCodeUrl` is provided, and a form with inputs for each entry in `PROFILE_FIELDS`. Input changes update the `profile` via `onProfileChange`.
 *
 * @param {{profile: Profile, qrCodeUrl: string, onProfileChange: import("react").Dispatch<import("react").SetStateAction<Profile>>}} props
 * @param {Profile} props.profile - The current profile values used as input values.
 * @param {string} props.qrCodeUrl - URL of the QR image; when falsy no image is rendered.
 * @param {import("react").Dispatch<import("react").SetStateAction<Profile>>} props.onProfileChange - State setter invoked with an updater to apply profile changes.
 * @returns {JSX.Element} The identity card UI containing the QR panel and profile form.
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
