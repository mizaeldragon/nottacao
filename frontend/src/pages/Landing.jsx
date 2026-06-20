import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench, DollarSign, ShoppingCart, Users, FileDown, TrendingUp,
  LayoutDashboard, Check, ChevronDown, ArrowRight,
  Smartphone, BarChart2, UserSquare, Home, Tag, HelpCircle, LogIn,
} from 'lucide-react';

const BG   = '#ffffff';
const CARD = '#ffffff';
const GRAD = 'linear-gradient(135deg, #0096EF 0%, #0A67E2 100%)';
const COR1 = '#0096EF';
const COR2 = '#0A67E2';

/* ── dados ────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Wrench,          titulo: 'Gestão de Serviços',
    texto: 'Lance cada serviço em segundos. A divisão entre funcionário e patrão é calculada automaticamente conforme o percentual que você definiu.',
    itens: ['Divisão automática configurável', 'Forma de pagamento por serviço', 'Dados de cliente, veículo e placa', 'Histórico do dia em tempo real'] },
  { icon: DollarSign,      titulo: 'Controle de Caixa',
    texto: 'Abra o caixa, registre suprimentos e sangrias e feche o dia com conferência de gaveta e resumo por forma de pagamento.',
    itens: ['Abertura com valor de troco', 'Suprimentos e sangrias', 'Conferência de gaveta no fechamento', 'Exportação em PDF'] },
  { icon: ShoppingCart,    titulo: 'PDV & Estoque',
    texto: 'PDV com carrinho, grid de produtos por categoria, controle de estoque mínimo e alertas automáticos quando o produto está acabando.',
    itens: ['Venda à vista ou fiado', 'Divisão de pagamento (múltiplas formas)', 'Alertas de estoque baixo', 'Recibo de venda em PDF'] },
  { icon: UserSquare,      titulo: 'Clientes & Fiado',
    texto: 'Cadastre clientes, registre vendas no fiado e acompanhe o saldo devedor de cada um. Recebimento parcial ou total com um clique.',
    itens: ['Cadastro completo de clientes', 'Controle de contas a receber', 'Recebimento parcial ou total', 'Histórico por cliente'] },
  { icon: FileDown,        titulo: 'Histórico & Relatórios',
    texto: 'Filtros por período, desempenho por funcionário, gráfico de faturamento por dia e exportação em PDF com um clique.',
    itens: ['Comissões por funcionário', 'Faturamento por dia (gráfico)', 'Vendas de produtos no período', 'Relatório em PDF completo'] },
  { icon: TrendingUp,      titulo: 'Financeiro (DRE)',
    texto: 'Faturamento menos comissões, CMV e despesas fixas = lucro real do dono. Registre acertos de comissão e despesas mensais.',
    itens: ['Despesas fixas mensais', 'Acerto de comissões', 'CMV automático por produto', 'Lucro real do período'] },
  { icon: LayoutDashboard, titulo: 'Dashboard',
    texto: 'Visão geral do dia: faturamento, serviços, vendas e fiado em aberto — com gráfico dos últimos 7 dias na tela inicial.',
    itens: ['Faturamento do dia', 'Serviços e vendas em tempo real', 'Alerta de estoque baixo', 'Gráfico dos 7 dias'] },
  { icon: Smartphone,      titulo: 'Configurações & Acesso',
    texto: 'Gerencie funcionários, tipos de serviço, percentuais e usuários do sistema com perfis de admin e funcionário.',
    itens: ['Funcionários e tipos de serviço', 'Usuários admin / funcionário', 'Percentual configurável por serviço', 'Instala como app (PWA)'] },
];

const FAQS = [
  { p: 'Preciso instalar algum aplicativo?',       r: 'Não. O sistema roda direto no navegador do celular, tablet ou computador. Mas você pode instalar como app (PWA) na tela inicial do seu celular sem precisar da App Store ou Play Store.' },
  { p: 'Quantos funcionários posso cadastrar?',    r: 'Ilimitados. Você cadastra quantos funcionários e tipos de serviço quiser, sem custo adicional.' },
  { p: 'Como funciona a divisão de comissões?',    r: 'Você define um percentual por tipo de serviço (ex: 50% funcionário / 50% patrão). Ao lançar o serviço, o sistema calcula automaticamente quanto cada um recebe.' },
  { p: 'Posso controlar o estoque de produtos?',   r: 'Sim. Você cadastra produtos com preço de custo e venda, controla entradas e saídas, define estoque mínimo e recebe alertas quando o produto está acabando. Há também um PDV para registrar vendas.' },
  { p: 'O sistema tem controle financeiro completo?', r: 'Sim. Além do caixa diário, há um módulo Financeiro (exclusivo para admin) com DRE do período: faturamento − comissões − CMV − despesas fixas = lucro real do dono.' },
  { p: 'O que acontece se eu atrasar o pagamento?', r: 'Seu acesso fica suspenso até a regularização. Nenhum dado é apagado — assim que o pagamento for confirmado, tudo volta normalmente.' },
];

const BENEFICIOS = [
  'Lançamento de serviços com divisão automática',
  'Controle de caixa diário com conferência',
  'PDV completo com controle de estoque',
  'Clientes, fiado e contas a receber',
  'DRE e lucro real do período',
  'Relatórios em PDF ilimitados',
  'Múltiplos usuários com permissões',
  'Funciona no celular como app',
];

/* ── FAQ item ─────────────────────────────────────────────── */
function FaqItem({ p, r }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-semibold text-slate-800 text-sm sm:text-base">{p}</span>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-slate-600 text-sm pb-4 leading-relaxed">{r}</p>}
    </div>
  );
}

/* ── Hero mockup ──────────────────────────────────────────── */
function HeroMockup() {
  return (
    <div className="relative w-full">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* topo com stats */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-4">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Dashboard</span>
          <div className="flex items-center gap-2 sm:gap-5 ml-auto flex-wrap justify-end">
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] text-slate-400">Faturamento Hoje</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900">R$ 2.530,00</p>
            </div>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] text-slate-400">Serviços</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900">24</p>
            </div>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] text-slate-400">Caixa</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-600">Aberto</p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {/* gráfico semanal */}
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] sm:text-xs font-bold text-slate-700">Faturamento Semanal</p>
              <span className="text-[9px] sm:text-[10px] text-slate-400">Esta semana</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ height: 72, background: `${COR1}15` }}>
              <svg viewBox="0 0 400 90" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COR1} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={COR1} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d="M0,80 C30,70 60,65 90,50 C120,35 150,55 180,40 C210,25 240,30 270,15 C300,5 330,12 360,8 C375,6 390,4 400,2"
                  stroke={COR1} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M0,80 C30,70 60,65 90,50 C120,35 150,55 180,40 C210,25 240,30 270,15 C300,5 330,12 360,8 C375,6 390,4 400,2 L400,90 L0,90 Z"
                  fill="url(#hg)" />
                {[[90,50],[180,40],[270,15],[400,2]].map(([x,y],i) => (
                  <circle key={i} cx={x} cy={y} r="3.5" fill={COR1} />
                ))}
              </svg>
            </div>
            <div className="flex justify-between px-1 mt-1">
              {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
                <span key={d} className="text-[8px] sm:text-[9px] text-slate-400">{d}</span>
              ))}
            </div>
          </div>

          {/* serviços recentes */}
          <div className="space-y-1 sm:space-y-1.5 mb-3 sm:mb-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide">Serviços recentes</p>
            {[
              { nome: 'Troca de pneu', func: 'João Silva', val: 'R$ 120,00' },
              { nome: 'Remendo a quente', func: 'José Lima', val: 'R$ 35,00' },
              { nome: 'Balanceamento', func: 'João Silva', val: 'R$ 60,00' },
            ].map((s) => (
              <div key={s.nome} className="flex items-center justify-between bg-slate-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-800">{s.nome}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 hidden sm:block">{s.func}</p>
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-slate-900">{s.val}</p>
              </div>
            ))}
          </div>

          {/* total */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 uppercase tracking-wide">Total do dia</p>
              <p className="text-base sm:text-lg font-extrabold text-amber-700">R$ 765,00</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] sm:text-[10px] text-amber-500">Funcionários</p>
              <p className="text-xs sm:text-sm font-bold text-amber-700">R$ 382,50</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -top-3 -right-2 sm:-right-3 text-white rounded-xl px-2.5 sm:px-3 py-1.5 shadow-lg text-[10px] sm:text-xs font-bold"
           style={{ background: GRAD }}>
        Atualizado em tempo real
      </div>
    </div>
  );
}

/* ── Caixa mockup ─────────────────────────────────────────── */
function CaixaMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-full max-w-xs sm:max-w-sm mx-auto lg:mx-0">
      <div className="px-4 sm:px-5 py-4" style={{ background: GRAD }}>
        <p className="text-xs text-white/70 font-medium">Caixa · Hoje</p>
        <p className="text-2xl sm:text-3xl font-bold text-white mt-1">R$ 50,00</p>
        <p className="text-xs text-white/70 mt-1">Valor inicial / troco</p>
      </div>

      <div className="p-3 sm:p-4 space-y-0.5">
        {[
          { label: 'Lançar Serviço',       grad: true },
          { label: 'Suprimento de Caixa',  grad: false },
          { label: 'Pagamento de Despesa', grad: false },
          { label: 'Sangria de Gaveta',    grad: false },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
            <span className="text-sm font-medium" style={item.grad ? { color: COR1 } : { color: '#64748b' }}>{item.label}</span>
            <ArrowRight size={14} className="text-slate-300" />
          </div>
        ))}
      </div>

      <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 bg-slate-50 rounded-xl p-3 border border-slate-200">
        <p className="text-[10px] text-slate-400 mb-2 font-semibold">MOVIMENTAÇÕES DO DIA</p>
        {[
          { desc: 'Troca de pneu — João', val: '+R$ 80,00', cor: 'text-emerald-600' },
          { desc: 'Remendo — Maria',       val: '+R$ 25,00', cor: 'text-emerald-600' },
          { desc: 'Sangria',               val: '-R$ 30,00', cor: 'text-red-500' },
        ].map((m) => (
          <div key={m.desc} className="flex justify-between items-center py-1">
            <span className="text-xs text-slate-600 truncate">{m.desc}</span>
            <span className={`text-xs font-bold shrink-0 ml-2 ${m.cor}`}>{m.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bottom nav item ──────────────────────────────────────── */
function BottomNavItem({ icon: Icon, label, href, to, active }) {
  const cls = `flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors ${
    active ? '' : 'text-slate-400 hover:text-slate-600'
  }`;
  const content = (
    <>
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} style={active ? { color: COR1 } : {}} />
      <span className="text-[10px] font-semibold" style={active ? { color: COR1 } : {}}>{label}</span>
    </>
  );
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <a href={href} className={cls}>{content}</a>;
}

/* ── página principal ─────────────────────────────────────── */
export default function Landing() {
  // eslint-disable-next-line no-unused-vars
  const [activeNav] = useState('inicio');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ backgroundColor: BG }} className="min-h-screen text-slate-800 pb-16 lg:pb-0">

      {/* ── Navbar — sempre fixed, flutua ao rolar ─────────── */}
      <div className="h-16" /> {/* spacer para compensar o fixed */}
      <header
        style={{
          position: 'fixed',
          zIndex: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          transition: 'top 0.5s cubic-bezier(0.4,0,0.2,1), width 0.5s cubic-bezier(0.4,0,0.2,1), max-width 0.5s cubic-bezier(0.4,0,0.2,1), height 0.5s cubic-bezier(0.4,0,0.2,1), border-radius 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.5s cubic-bezier(0.4,0,0.2,1), border 0.5s cubic-bezier(0.4,0,0.2,1)',
          top:          scrolled ? '1rem'               : '0px',
          width:        scrolled ? 'calc(100% - 3rem)'  : '100%',
          maxWidth:     scrolled ? '72rem'               : '100%',
          height:       scrolled ? '72px'               : '64px',
          borderRadius: scrolled ? '1rem'               : '0',
          boxShadow:    scrolled ? '0 8px 40px rgba(0,0,0,0.13)' : 'none',
          background:   'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          borderBottom: 'none',
        }}
      >
        <div className="h-full max-w-6xl mx-auto px-5 flex items-center justify-between gap-4">
          <img
            src="/logo.png"
            alt="nottação"
            className="shrink-0"
            style={{
              height: scrolled ? '36px' : '48px',
              transition: 'height 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          />

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#funcionalidades" className="hover:text-slate-900 transition-colors">Funcionalidades</a>
            <a href="#preco"           className="hover:text-slate-900 transition-colors">Preço</a>
            <a href="#faq"             className="hover:text-slate-900 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden lg:block px-3 h-9 leading-9 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Entrar
            </Link>
            <a href="#preco" className="h-9 px-4 inline-flex items-center text-white text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap"
                  style={{ background: GRAD }}>
              Começar agora
            </a>
          </div>
        </div>
      </header>

      {/* ── Bottom nav mobile/tablet ────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <BottomNavItem icon={Home}            label="Início"   href="#"                active={activeNav === 'inicio'} />
        <BottomNavItem icon={LayoutDashboard} label="Funções"  href="#funcionalidades" active={activeNav === 'func'}   />
        <BottomNavItem icon={Tag}             label="Preço"    href="#preco"            active={activeNav === 'preco'}  />
        <BottomNavItem icon={HelpCircle}      label="FAQ"      href="#faq"              active={activeNav === 'faq'}    />
        <BottomNavItem icon={LogIn}           label="Entrar"   to="/login"              active={false}                  />
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 lg:py-20 grid lg:grid-cols-[1fr_1.15fr] gap-8 lg:gap-12 items-center">

          {/* texto */}
          <div className="order-1">
            <span className="inline-block text-xs font-bold border rounded-full px-3 py-1 mb-4 sm:mb-5"
                  style={{ color: COR1, borderColor: `${COR1}55`, background: `${COR1}12` }}>
              Para cada borracharia
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900 mb-4">
              O sistema completo para a sua{' '}
              <span className="italic" style={{ color: COR1 }}>borracharia</span>
            </h1>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-5 sm:mb-6 max-w-md">
              Controle serviços, caixa, estoque, clientes, fiado e o financeiro do seu negócio direto do celular. Sem caderninho.
            </p>

            <ul className="space-y-2.5 mb-6 sm:mb-8">
              {[
                'Sem instalação complicada',
                'Funciona direto no celular',
                'Divisão automática para funcionário',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </span>
                  <span className="text-slate-700 font-medium text-sm sm:text-base">{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#preco" className="h-12 px-6 inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl transition-opacity hover:opacity-90 text-sm sm:text-base"
                    style={{ background: GRAD }}>
                Assinar agora <ArrowRight size={16} />
              </a>
              <a href="#funcionalidades" className="h-12 px-6 inline-flex items-center justify-center bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-colors text-sm sm:text-base">
                Ver funcionalidades
              </a>
            </div>
            <p className="text-xs text-slate-400 mt-4">7 dias grátis. Sem cartão de crédito. Cancele quando quiser.</p>
          </div>

          {/* mockup */}
          <div className="order-2 lg:pl-4 flex items-center justify-center">
            <img
              src="/hero.png"
              alt="Dashboard nottação"
              className="w-full max-w-lg lg:max-w-none drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="bg-white py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="rounded-2xl sm:rounded-3xl px-8 sm:px-14 py-10 sm:py-14 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8"
            style={{ background: GRAD }}
          >
            {[
              { valor: '8',     label: 'tipos de serviço pré-cadastrados' },
              { valor: '100%',  label: 'do caixa controlado em tempo real' },
              { valor: '0',     label: 'caderninho e planilha para manter' },
              { valor: 'R$200', label: 'por mês, com tudo incluso' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-none">{s.valor}</p>
                <p className="text-white/70 text-xs sm:text-sm mt-1.5 sm:mt-2 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-12 sm:py-16" style={{ backgroundColor: BG }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <span className="text-xs font-semibold border rounded-full px-3 py-1"
                  style={{ color: COR1, borderColor: `${COR1}55` }}>
              TUDO EM UM SÓ APP
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 mt-4 sm:mt-5 mb-3">
              Da OS ao lucro real,<br />sem perder nada de vista
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Cada parte do seu dia é organizada e conectada. O que você fazia no balcão virou relatório, comissão e lucro automaticamente.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, titulo, texto, itens }) => (
              <div
                key={titulo}
                style={{ backgroundColor: CARD }}
                className="feature-card rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shrink-0"
                  style={{ background: GRAD }}
                >
                  <Icon size={19} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1.5 leading-snug">{titulo}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{texto}</p>
                <div className="border-t border-slate-200 my-3" />
                <ul className="mt-auto space-y-1.5">
                  {itens.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs font-medium" style={{ color: COR1 }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COR1 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase: Caixa ─────────────────────────────────── */}
      <section className="bg-white py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">

          {/* 2 colunas */}
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-10 sm:mb-14">
            <CaixaMockup />

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COR1 }}>
                CONTROLE DE VERDADE
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-5 sm:mb-6">
                Você manda no negócio,<br />o app cuida das contas
              </h2>

              <div className="space-y-4 sm:space-y-6">
                {[
                  {
                    titulo: 'Lucro real, não só faturamento',
                    texto: 'O DRE mostra quanto sobrou de verdade no seu bolso depois de comissões, custo de produto e despesas fixas.',
                  },
                  {
                    titulo: 'Comissão sem briga',
                    texto: 'A divisão entre patrão e funcionário é calculada na hora do lançamento. No fim do mês, é só acertar o saldo.',
                  },
                  {
                    titulo: 'Decisão na palma da mão',
                    texto: 'Abra o app a qualquer hora e veja o caixa, o fiado em aberto e o desempenho de cada funcionário.',
                  },
                ].map(({ titulo, texto }) => (
                  <div key={titulo} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                         style={{ background: GRAD }}>
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 mb-1 text-sm sm:text-base">{titulo}</p>
                      <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 blocos abaixo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Smartphone, titulo: 'PWA instalável!',     texto: 'Instala direto no celular sem precisar de loja de aplicativos.' },
              { icon: BarChart2,  titulo: 'Interface responsiva', texto: 'Feita para uso no balcão, funciona bem em qualquer tela.' },
              { icon: Users,      titulo: 'Multiusuário',         texto: 'Admin e funcionários com permissões e acessos separados.' },
              { icon: TrendingUp, titulo: 'Sempre atualizado',    texto: 'Melhorias chegam automaticamente, sem você precisar fazer nada.' },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl border border-slate-200 p-4 sm:p-5 bg-slate-50">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: GRAD }}
                >
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-bold text-slate-900 mb-1 text-sm sm:text-base">{titulo}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="preco" className="bg-white py-12 sm:py-16 relative overflow-hidden">
        {/* Bolinhas flutuantes */}
        {[
          { size: 10, left: '8%',  delay: '0s',    dur: '7s',  op: 0.18 },
          { size: 6,  left: '18%', delay: '1.5s',  dur: '9s',  op: 0.12 },
          { size: 14, left: '28%', delay: '3s',    dur: '8s',  op: 0.15 },
          { size: 8,  left: '38%', delay: '0.8s',  dur: '11s', op: 0.20 },
          { size: 5,  left: '48%', delay: '4s',    dur: '7.5s',op: 0.10 },
          { size: 12, left: '58%', delay: '2s',    dur: '10s', op: 0.16 },
          { size: 7,  left: '68%', delay: '5s',    dur: '8.5s',op: 0.13 },
          { size: 16, left: '78%', delay: '1s',    dur: '9.5s',op: 0.14 },
          { size: 6,  left: '86%', delay: '3.5s',  dur: '7s',  op: 0.11 },
          { size: 9,  left: '94%', delay: '2.5s',  dur: '10s', op: 0.17 },
        ].map((b, i) => (
          <div key={i} className="pricing-bubble" style={{
            width: b.size, height: b.size, left: b.left,
            background: `radial-gradient(circle at 30% 30%, #ffffff 0%, ${COR1} 45%, ${COR2} 100%)`,
            opacity: b.op,
            animationDuration: b.dur,
            animationDelay: b.delay,
            boxShadow: `0 0 ${b.size * 1.2}px ${b.size * 0.6}px ${COR1}99, 0 0 ${b.size * 2.5}px ${b.size}px ${COR1}44`,
          }} />
        ))}
        <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
          <span className="text-xs font-bold border rounded-full px-3 py-1"
                style={{ color: COR1, borderColor: `${COR1}55`, background: `${COR1}12` }}>
            Preço
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 mb-2">
            Um preço justo para<br />a sua borracharia
          </h2>
          <p className="text-slate-500 mb-8 sm:mb-10 text-sm sm:text-base">Tudo liberado. Sem módulos extras. Sem pegadinha.</p>

          <div className="max-w-sm mx-auto bg-white rounded-2xl p-6 sm:p-8 shadow-xl relative"
               style={{ border: `2px solid ${COR1}` }}>
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap"
                  style={{ background: GRAD }}>
              PLANO ÚNICO
            </span>

            <p className="text-slate-500 text-sm mb-1">Por borracharia / mês</p>
            <div className="flex items-end justify-center gap-1 mb-5 sm:mb-6">
              <span className="text-xl sm:text-2xl font-bold text-slate-400 self-start mt-2">R$</span>
              <span className="text-5xl sm:text-6xl font-extrabold" style={{ color: COR1 }}>200</span>
              <span className="text-slate-400 text-sm mb-2">/mês</span>
            </div>

            <ul className="space-y-2 sm:space-y-2.5 text-left mb-6 sm:mb-8">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check size={15} className="mt-0.5 shrink-0" style={{ color: COR1 }} />
                  {b}
                </li>
              ))}
            </ul>

            <Link to="/registro" className="block w-full h-12 leading-[3rem] text-center text-white font-semibold rounded-xl transition-opacity hover:opacity-90"
                  style={{ background: GRAD }}>
              Criar conta e assinar
            </Link>
            <p className="text-xs text-slate-400 mt-3">Pix, boleto ou cartão via Asaas</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" style={{ backgroundColor: BG }} className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Tudo o que você precisa saber</h2>
            <p className="text-slate-500 text-sm sm:text-base">Dúvidas comuns antes de começar</p>
          </div>
          <div style={{ backgroundColor: CARD }} className="rounded-2xl border border-slate-200 px-4 sm:px-6">
            {FAQS.map((f) => <FaqItem key={f.p} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="bg-white py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-2xl sm:rounded-3xl px-8 sm:px-14 py-10 sm:py-14 text-center" style={{ background: GRAD }}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">
              Tire a borracharia do<br />caderninho hoje
            </h2>
            <p className="text-white/80 mb-6 sm:mb-8 text-base sm:text-lg">
              Crie sua conta em menos de 1 minuto e comece a controlar tudo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#preco" className="h-12 px-6 sm:px-8 inline-flex items-center justify-center gap-2 bg-white font-bold rounded-xl hover:bg-white/90 transition-colors"
                    style={{ color: COR2 }}>
                Assinar agora <ArrowRight size={16} />
              </a>
              <Link to="/login" className="h-12 px-6 sm:px-8 inline-flex items-center justify-center border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors">
                Já tenho conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
          <div className="col-span-2 sm:col-span-1">
            <img src="/logo.png" alt="nottação" className="h-10 w-auto mb-3" />
            <p className="text-sm text-slate-500 leading-relaxed">
              Sistema de gestão completo para borracharias.<br className="hidden sm:block" />
              Do serviço ao lucro real.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Produto</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#funcionalidades" className="hover:text-slate-900 transition-colors">Funcionalidades</a></li>
              <li><a href="#preco"           className="hover:text-slate-900 transition-colors">Preço</a></li>
              <li><a href="#faq"             className="hover:text-slate-900 transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/termos"      className="hover:text-slate-900 transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-slate-900 transition-colors">Política de Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div>
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} nottação. Todos os direitos reservados.</p>
            <p>Pagamentos seguros via Asaas</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
