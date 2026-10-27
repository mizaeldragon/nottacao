import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const TemaContext = createContext(null);

// 'sistema' = segue a preferência do aparelho (padrão de quem nunca escolheu).
// A escolha manual fica salva e manda nisso.
const CHAVE = 'tema';

function preferenciaSalva() {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

function aparelhoNoEscuro() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function TemaProvider({ children }) {
  const [tema, setTemaState] = useState(preferenciaSalva); // 'claro' | 'escuro' | 'sistema'
  const [escuro, setEscuro] = useState(
    () => preferenciaSalva() === 'escuro' || (preferenciaSalva() === 'sistema' && aparelhoNoEscuro())
  );

  // Aplica no <html> — o CSS inteiro pendura em data-theme.
  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', escuro ? '#080c14' : '#ffffff');
  }, [escuro]);

  // Enquanto estiver em 'sistema', acompanha o aparelho mudando de tema sozinho.
  useEffect(() => {
    if (tema !== 'sistema') {
      setEscuro(tema === 'escuro');
      return;
    }
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    setEscuro(mq.matches);
    const ouvir = (e) => setEscuro(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, [tema]);

  const setTema = useCallback((novo) => {
    setTemaState(novo);
    try {
      if (novo === 'sistema') localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, novo);
    } catch {
      /* navegador sem storage (aba anônima): o tema vale só nesta sessão */
    }
  }, []);

  const alternar = useCallback(() => setTema(escuro ? 'claro' : 'escuro'), [escuro, setTema]);

  return (
    <TemaContext.Provider value={{ tema, escuro, setTema, alternar }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema() {
  return useContext(TemaContext);
}
