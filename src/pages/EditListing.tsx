import { useParams } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import ListingForm from '../components/ListingForm';

export default function EditListing() {
  const { slug } = useParams<{ slug: string }>();
  usePageMeta('Modifier mon annonce', 'Modifiez le contenu, le prix ou les photos de votre annonce.');
  return (
    <div className="container page-narrow">
      <h1 className="page-title">Modifier mon annonce</h1>
      <ListingForm mode="edit" slug={slug} />
    </div>
  );
}
