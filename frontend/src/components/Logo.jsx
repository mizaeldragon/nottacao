import { useTema } from '../context/TemaContext';

// O logo original tem a palavra "notta" em preto puro, que sumiria no fundo
// escuro. logo-dark.png é o mesmo arquivo com essa parte em branco — o azul
// da marca (o "ção" e o ícone) é idêntico nos dois.
export default function Logo({ className = '', style, alt = 'nottação' }) {
  const { escuro } = useTema();

  return (
    <img
      src={escuro ? '/logo-dark.png' : '/logo.png'}
      alt={alt}
      className={className}
      style={style}
    />
  );
}
