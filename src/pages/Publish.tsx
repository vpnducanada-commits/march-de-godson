import { usePageMeta } from '../hooks/usePageMeta';
import ListingForm from '../components/ListingForm';

export default function Publish() {
  usePageMeta('Publier une annonce', 'Publiez gratuitement votre annonce sur GODSON Marketplace : photos, prix en FCFA, localité et contact direct.');
  return (
    <div className="container page-narrow">
      <h1 className="page-title">Publier une annonce</h1>
      <p className="page-sub">
        Remplissez ce formulaire pour rendre votre annonce visible par des acheteurs
        partout au Gabon. La publication est gratuite.
      </p>
      <ListingForm mode="create" />
    </div>
  );
}
