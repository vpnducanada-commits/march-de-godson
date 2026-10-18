import { useParams } from 'react-router-dom';
import Catalog from './Catalog';

/** Page de catégorie : le catalogue verrouillé sur une catégorie. */
export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  return <Catalog fixedCat={slug} />;
}
