import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { usePageMeta } from '../hooks/usePageMeta';

export interface StaticContent {
  title: string;
  description: string;
  intro?: string;
  sections: { heading: string; body: ReactNode }[];
}

export const StaticContent: Record<'faq' | 'about' | 'security' | 'terms' | 'privacy', StaticContent> = {
  about: {
    title: 'À propos',
    description: 'GODSON Marketplace, la plateforme de petites annonces du Gabon : acheter, vendre et trouver des services partout au pays.',
    intro:
      'GODSON Marketplace est une plateforme gabonaise de petites annonces et de commerce en ligne. Elle permet aux particuliers, commerçants, artisans et entreprises de publier des annonces et de entrer en contact direct avec des acheteurs potentiels — du nord au sud du Gabon.',
    sections: [
      {
        heading: 'Notre mission',
        body: (
          <p>
            Rendre simple la découverte de produits, de services et de vendeurs au Gabon :
            comparer les annonces, les prix et les localités, et contacter directement le
            vendeur, sans intermédiaire.
          </p>
        ),
      },
      {
        heading: 'Comment fonctionne la plateforme',
        body: (
          <ul>
            <li>Chacun peut consulter les annonces gratuitement, sans compte.</li>
            <li>La publication est gratuite : un compte est nécessaire pour publier et gérer vos annonces.</li>
            <li>Les acheteurs contactent les vendeurs directement (téléphone ou WhatsApp) et négocient eux-mêmes le prix et la remise.</li>
            <li>GODSON Marketplace ne collecte aucun paiement : nous ne sommes pas intermédiaire financier.</li>
          </ul>
        ),
      },
      {
        heading: 'Notre territoire',
        body: (
          <p>
            Le lancement est dédié au <strong>Gabon</strong> : Libreville, Owendo, Akanda,
            Port-Gentil, Franceville, Moanda, Lambaréné, Tchibanga, Mouila, Kango, Oyem et
            d'autres localités. Le catalogue de localités s'élargit régulièrement.
          </p>
        ),
      },
      {
        heading: 'La marque',
        body: (
          <>
            <p>
              GODSON Marketplace est un projet de la marque <strong>Godson</strong>, conçu au
              Gabon et pour le Gabon, avec une ambition : devenir la référence locale des
              petites annonces, de manière fiable, simple et évolutive.
            </p>
            <p className="static-section__credit">
              Créé par <strong>Gédéon OKANA</strong> (alias <strong>Godson</strong>).
            </p>
          </>
        ),
      },
    ],
  },
  faq: {
    title: 'FAQ',
    description: 'Questions fréquentes : publication, paiement, sécurité, compte et modération sur GODSON Marketplace.',
    intro: 'Les réponses aux questions les plus fréquentes. Pour un signalement, utilisez le bouton « Signaler » présent sur chaque annonce.',
    sections: [
      {
        heading: 'Publication',
        body: (
          <dl className="faq-list">
            <dt>Comment publier une annonce ?</dt>
            <dd>
              Créez un compte (gratuit), cliquez sur « Publier », remplissez le formulaire
              (titre, catégorie, description, prix, localité, photos, contact) et validez.
              Votre annonce est immédiatement visible dans le catalogue.
            </dd>
            <dt>La publication est-elle payante ?</dt>
            <dd>
              Non. La publication est et restera gratuite pour la première version.
              Aucune carte bancaire n'est demandée.
            </dd>
            <dt>Combien de photos puis-je ajouter ?</dt>
            <dd>Jusqu'à 6 photos par annonce (JPG, PNG ou WebP, 4 Mo maximum par fichier). Les images sont compressées automatiquement.</dd>
            <dt>Puis-je modifier ou retirer mon annonce ?</dt>
            <dd>Oui, depuis « Mon espace » : modification, archivage (masque temporairement) ou suppression définitive.</dd>
          </dl>
        ),
      },
      {
        heading: 'Paiement et transactions',
        body: (
          <dl className="faq-list">
            <dt>Peut-on payer en ligne sur la plateforme ?</dt>
            <dd>
              Non. GODSON Marketplace est une plateforme de mise en relation : l'acheteur et
              le vendeur négocient et règlent directement entre eux. Nous ne prenons jamais en
              charge les paiements.
            </dd>
            <dt>Quel moyen de paiement est recommandé ?</dt>
            <dd>
              <strong>Airtel Money</strong>, convenu directement avec le vendeur. NB : ne payez
              que si vous avez confiance au vendeur — en cas de doute, ou si vous ne connaissez
              pas son identité, payez à la livraison après avoir vu l'article.
            </dd>
            <dt>La plateforme est-elle responsable des transactions ?</dt>
            <dd>
              Non. Chaque transaction est le fait des deux parties. Lisez attentivement nos{' '}
              <Link to="/securite">conseils de sécurité</Link> avant d'acheter.
            </dd>
          </dl>
        ),
      },
      {
        heading: 'Compte et données',
        body: (
          <dl className="faq-list">
            <dt>Faut-il un compte pour consulter les annonces ?</dt>
            <dd>Non, la consultation est libre. Un compte est requis pour publier, gérer ses annonces et sauvegarder ses favoris.</dd>
            <dt>Que se passe-t-il si je perds mon mot de passe ?</dt>
            <dd>Utilisez « Mot de passe oublié » sur la page de connexion : un lien de réinitialisation est envoyé à votre email.</dd>
            <dt>Mes données personnelles sont-elles partagées ?</dt>
            <dd>
              Non. Consultez notre <Link to="/confidentialite">politique de confidentialité</Link> pour savoir quelles données sont publiques (nom affiché, ville, type de compte) et lesquelles ne le sont pas.
            </dd>
          </dl>
        ),
      },
      {
        heading: 'Modération',
        body: (
          <dl className="faq-list">
            <dt>Que peut signaler un utilisateur ?</dt>
            <dd>
              Une annonce frauduleuse, un produit interdit, un contenu inapproprié, une
              catégorie incorrecte ou tout autre abus. Le bouton « Signaler » est disponible
              sur chaque annonce.
            </dd>
            <dt>Une annonce peut-elle être refusée ?</dt>
            <dd>
              Oui. Les annonces de produits ou services illégaux, interdits ou dangereux sont
              refusées. Les règles détaillées figurent dans nos <Link to="/conditions">conditions d'utilisation</Link>.
            </dd>
          </dl>
        ),
      },
    ],
  },
  security: {
    title: 'Conseils de sécurité',
    description: 'Les bonnes pratiques pour acheter et vendre en sécurité sur GODSON Marketplace : rencontres, paiements, vigilance.',
    intro:
      'GODSON Marketplace met en relation des particuliers et des professionnels. Pour protéger les deux parties, suivez ces règles simples avant toute transaction.',
    sections: [
      {
        heading: 'Avant d\'acheter',
        body: (
          <ul>
            <li><strong>Restez sur la plateforme</strong> pour la mise en relation, et méfiez-vous des vendeurs qui proposent des canaux inhabituels.</li>
            <li><strong>Exigez des photos réelles</strong> du produit exact, et vérifiez la cohérence de l'annonce (prix trop bas = signal d'alerte).</li>
            <li><strong>Ne payez jamais une avance</strong> avant d'avoir vu et vérifié le produit.</li>
            <li><strong>Privilégiez les rencontres en lieu public</strong> et de jour (centre commercial, gare routière, agence bancaire).</li>
            <li><strong>Vérifiez le produit sur place</strong> avant de payer : allumez l'appareil, testez la connectivité, contrôlez les papiers des véhicules.</li>
          </ul>
        ),
      },
      {
        heading: 'Le paiement',
        body: (
          <ul>
            <li>
              Le moyen de paiement le plus courant au Gabon est <strong>Airtel Money</strong> :
              convenez-en directement avec le vendeur.
            </li>
            <li>
              <strong>NB : ne payez que si vous avez confiance au vendeur</strong> — en cas de
              doute, ou si vous ne connaissez pas l'identité du vendeur, payez à la livraison,
              après avoir vu et vérifié l'article.
            </li>
            <li>Privilégiez le <strong>paiement à la remise</strong>, en main propre.</li>
            <li>Pour les objets de valeur, un <strong>reçu écrit</strong> signé par les deux parties protège tout le monde.</li>
            <li>Les paiements mobile money s'effectuent <strong>uniquement face à face</strong> après vérification du produit.</li>
            <li><strong>Jamais</strong> de virement à un inconnu pour « réserver » un article.</li>
          </ul>
        ),
      },
      {
        heading: 'Les signalements',
        body: (
          <p>
            Vous avez repéré une annonce suspecte, un vendeur qui harcèle ou un contenu
            illégal ? Utilisez le bouton <strong>« Signaler »</strong> de la page de
            l'annonce. Nos équipes examinent chaque signalement et peuvent refuser
            l'annonce ou suspendre le compte concerné.
          </p>
        ),
      },
      {
        heading: 'Ce que fait la plateforme',
        body: (
          <ul>
            <li>Modération des annonces et traitement des signalements.</li>
            <li>Suspension des comptes en cas de récidive ou de contenu interdit.</li>
            <li>Validation des coordonnées de contact à la publication.</li>
            <li>Aucune vente n'est présentée comme « garantie » par la plateforme.</li>
          </ul>
        ),
      },
    ],
  },
  terms: {
    title: "Conditions d'utilisation",
    description: "Les règles d'utilisation de GODSON Marketplace : publication, interdits, responsabilité et suspension des comptes.",
    intro:
      'En utilisant GODSON Marketplace, vous acceptez les présentes conditions. Elles s\'appliquent à toute personne visitant, publiant ou s\'inscrivant sur la plateforme.',
    sections: [
      {
        heading: '1. Objet du service',
        body: (
          <p>
            GODSON Marketplace est une plateforme de mise en relation : elle permet de
            publier et de consulter des annonces de produits et de services au Gabon. La
            plateforme ne vend aucun produit, ne perçoit aucun paiement et n'intervient pas
            dans les transactions entre utilisateurs.
          </p>
        ),
      },
      {
        heading: '2. Inscription et compte',
        body: (
          <p>
            L'inscription est réservée aux personnes pouvant contracter au Gabon. Vous vous
            engagez à fournir des informations exactes, à garder confidentiel votre mot de
            passe et à notifier immédiatement tout usage non autorisé de votre compte.
          </p>
        ),
      },
      {
        heading: '3. Règles de publication',
        body: (
          <ul>
            <li>Annonces honnêtes, exactes et non trompeuses.</li>
            <li>Produits et services légaux uniquement.</li>
            <li>Interdits notamment : armes, stupéfiants, produits volés ou de contrefaçon, contenus illicites, services non conformes à la loi gabonaise, annonces de personnes, arnaques et usurpation.</li>
            <li>Pas de publicité déguisée en annonce sans mention claire.</li>
            <li>Coordonnées de contact valides et appartenant à l'annonceur.</li>
          </ul>
        ),
      },
      {
        heading: '4. Modération',
        body: (
          <p>
            GODSON Marketplace peut examiner, modifier, refuser ou retirer toute annonce
            contraire aux présentes conditions ou à la loi, ainsi que suspendre ou supprimer
            les comptes en cas de violation. Un journal d'audit conserve les actions de
            modération.
          </p>
        ),
      },
      {
        heading: '5. Responsabilité',
        body: (
          <p>
            Les transactions sont conclues entre les utilisateurs. GODSON Marketplace ne
            garantit ni l'exactitude des annonces, ni la qualité des produits, ni
            l'exécution des transactions. Les utilisateurs sont seuls responsables de leurs
            actes et des informations publiées.
          </p>
        ),
      },
      {
        heading: '6. Propriété intellectuelle',
        body: (
          <p>
            La marque GODSON, le monogramme GM, l'interface et le contenu éditorial de la
            plateforme sont protégés. Les annonces publiées restent la propriété de leurs
            auteurs ; en les publiant, vous autorisez la plateforme à les afficher sur ses
            services.
          </p>
        ),
      },
      {
        heading: '7. Droit applicable',
        body: (
          <p>
            Les présentes conditions sont régies par le droit de la République Gabonaise.
            Elles seront mises à jour au besoin ; la version publiée fait foi.
          </p>
        ),
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    description: 'Données collectées par GODSON Marketplace, leurs usages, vos droits et la sécurité des données.',
    intro:
      'Cette politique décrit quelles données nous collectons, pourquoi, et comment vous pouvez exercer vos droits. Elle sera revue avant le lancement public et soumise à validation juridique.',
    sections: [
      {
        heading: '1. Données collectées',
        body: (
          <ul>
            <li><strong>Compte</strong> : email de connexion (non public), nom affiché, pseudonyme, ville, type de compte.</li>
            <li><strong>Annonces</strong> : contenu des annonces, prix, localité, photos, coordonnées de contact que vous choisissez de publier.</li>
            <li><strong>Utilisation</strong> : consultations et favoris liés à votre compte, journal d'audit des actions de modération.</li>
          </ul>
        ),
      },
      {
        heading: '2. Usage des données',
        body: (
          <p>
            Les données sont utilisées pour : faire fonctionner le service (compte,
            publication, favoris), vous contacter si nécessaire, modérer le contenu et
            protéger la sécurité de la plateforme. Nous ne vendons pas vos données à des
            tiers et ne les utilisons pas pour de la publicité ciblée.
          </p>
        ),
      },
      {
        heading: '3. Données publiques',
        body: (
          <p>
            Sont publiques : le nom affiché, le pseudonyme, la ville, le type de compte, le
            contenu de vos annonces et les coordonnées de contact que vous renseignez dans
            vos annonces. Votre email n'est jamais affiché publiquement.
          </p>
        ),
      },
      {
        heading: '4. Sécurité',
        body: (
          <p>
            Les mots de passe sont chiffrés ; les accès aux données sont restreints par des
            règles d'autorisation au niveau de la base de données (un utilisateur ne peut
            lire ou modifier que ses propres données). Les images sont stockées dans un
            espace privé à accès contrôlé.
          </p>
        ),
      },
      {
        heading: '5. Vos droits',
        body: (
          <p>
            Vous pouvez accéder, rectifier ou supprimer vos données, et supprimer votre
            compte (avec ses annonces) à tout moment. Pour exercer vos droits, utilisez le
            bouton « Signaler » en précisant votre demande, ou contactez l'équipe
            d'administration.
          </p>
        ),
      },
      {
        heading: '6. Cookies et stockage local',
        body: (
          <p>
            Le site utilise le stockage local du navigateur pour : maintenir votre session,
            mémoriser vos favoris de visiteur avant connexion. Aucune traceuse publicitaire
            n'est utilisée.
          </p>
        ),
      },
    ],
  },
};

export default function StaticPage({ content }: { content: StaticContent }) {
  usePageMeta(content.title, content.description);
  return (
    <div className="container page-narrow static-page">
      <h1 className="page-title">{content.title}</h1>
      {content.intro && <p className="page-sub">{content.intro}</p>}
      {content.sections.map((s) => (
        <section key={s.heading} className="static-section">
          <h2 className="static-section__h">
            <Icon name="chevron-right" size={16} />
            {s.heading}
          </h2>
          {s.body}
        </section>
      ))}
    </div>
  );
}
