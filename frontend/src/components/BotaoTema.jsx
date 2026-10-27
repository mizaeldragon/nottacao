import { Moon, Sun } from 'lucide-react';
import { useTema } from '../context/TemaContext';

// Troca claro/escuro nas telas de fora do sistema (landing, login, termos).
// Dentro do app o lugar é o menu do usuário.
//
// sobreEscuro: para as telas de acesso, que têm fundo escuro NOS DOIS temas —
// ali o botão precisa ser claro sempre, senão some no modo claro.
export default function BotaoTema({ className = '', sobreEscuro = false }) {
  const { escuro, alternar } = useTema();
  const rotulo = escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';

  return (
    <button
      onClick={alternar}
      title={rotulo}
      aria-label={rotulo}
      className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-colors ${
        sobreEscuro
          ? 'border-white/20 text-white/80 hover:text-white hover:bg-white/10'
          : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      } ${className}`}
    >
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
