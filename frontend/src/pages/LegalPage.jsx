import { Link } from 'react-router-dom';
import EtherXLogo from '../components/brand/EtherXLogo';
import { ROUTES } from '../utils/constants';
import '../styles/auth.css';

// PLACEHOLDER policy text: replace every section with the wording approved for EtherX Innovations
// before launch. Kept as data so the real text drops in without touching the layout.
const PAGES = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using EtherX Meet', 'Describe who may use the service, account requirements and acceptable use.'],
      ['Meetings and content', 'Describe ownership of meeting content, recordings, chat, files and whiteboards.'],
      ['Your responsibilities', 'Describe what users must not do, and how hosts are responsible for their meetings.'],
      ['Termination', 'Describe when accounts may be suspended or closed.'],
      ['Liability', 'Describe warranties, limits of liability and governing law.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we collect', 'Describe account data (name, email, Google profile photo), meeting metadata and recordings.'],
      ['How we use it', 'Describe running meetings, sign-in, invitations, analytics and support.'],
      ['Sharing', 'Describe service providers (hosting, email delivery, TURN relay) and any other disclosures.'],
      ['Retention', 'Describe how long accounts, recordings, chat and analytics are kept.'],
      ['Your choices', 'Describe access, correction, export and deletion requests, and how to contact you.'],
    ],
  },
};

export default function LegalPage({ page }) {
  const { title, sections } = PAGES[page];
  return (
    <div className="exm-auth">
      <header className="exm-auth-header">
        <Link to={ROUTES.HOME} aria-label="EtherX Meet home"><EtherXLogo className="exm-auth-logo" /></Link>
      </header>
      <main className="exm-legal">
        <h1>{title}</h1>
        <p className="exm-legal-draft" role="note">Draft: this page is a placeholder and is not yet the final policy.</p>
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
        <p className="exm-legal-nav">
          <Link to={page === 'terms' ? ROUTES.PRIVACY : ROUTES.TERMS}>{page === 'terms' ? 'Privacy Policy' : 'Terms of Service'}</Link>
          {' · '}
          <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
