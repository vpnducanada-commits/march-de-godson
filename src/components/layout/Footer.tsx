import { Link } from 'react-router-dom';
import { Logo } from '../Logo';
import { Icon } from '../Icon';
import { APP_VERSION } from '../../lib/version';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo variant="light" as="div" />
          <p className="footer__slogan">Le marché gabonais, à portée de clic.</p>
          <p className="footer__note">
            Plateforme de petites annonces. GODSON Marketplace ne prend pas part aux
            transactions : l'acheteur et le vendeur négocient directement.
          </p>
        </div>
        <nav className="footer__col" aria-label="Plateforme">
          <h4 className="footer__h">Plateforme</h4>
          <Link to="/apropos">À propos</Link>
          <Link to="/faq">Comment ça marche</Link>
          <Link to="/publier">Publier une annonce</Link>
          <Link to="/securite">Conseils de sécurité</Link>
          <Link to="/faq">FAQ</Link>
        </nav>
        <nav className="footer__col" aria-label="Légal">
          <h4 className="footer__h">Informations légales</h4>
          <Link to="/conditions">Conditions d'utilisation</Link>
          <Link to="/confidentialite">Politique de confidentialité</Link>
          <Link to="/securite">Sécurité & modération</Link>
        </nav>
        <div className="footer__col footer__col--contact">
          <h4 className="footer__h">Contact</h4>
          <p className="footer__contact">
            <Icon name="shield" size={15} />
            Signalez un problème directement depuis la page d'une annonce (bouton
            « Signaler »). Le formulaire de contact général sera disponible à la
            prochaine étape.
          </p>
        </div>
      </div>
      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span>© {new Date().getFullYear()} GODSON Marketplace — Fait avec soin au Gabon 🇬🇦</span>
          <span className="footer__brand-mini">Marque : Godson · {APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
