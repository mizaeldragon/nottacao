import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const COR = '#0096EF';

function Section({ titulo, children }) {
  return (
    <div>
      <h2 className="text-base font-bold text-slate-900 mb-2">{titulo}</h2>
      <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <div className="w-px h-5 bg-slate-200" />
          <img src="/logo.png" alt="nottação" className="h-10 w-auto" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <span className="text-xs font-bold border rounded-full px-3 py-1"
                style={{ color: COR, borderColor: `${COR}55`, background: `${COR}12` }}>
            Legal
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-2">Política de Privacidade</h1>
          <p className="text-slate-400 text-sm">Última atualização: junho de 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
          <Section titulo="1. Informações coletadas">
            Coletamos dados fornecidos por você no cadastro (nome, e-mail, telefone, CNPJ/CPF) e dados operacionais gerados pelo uso do sistema (serviços, clientes, movimentações de caixa e estoque).
          </Section>
          <Section titulo="2. Uso das informações">
            Os dados são utilizados exclusivamente para operar o sistema, processar pagamentos, enviar comunicações sobre o serviço e cumprir obrigações legais. Não vendemos nem compartilhamos seus dados com terceiros para fins comerciais.
          </Section>
          <Section titulo="3. Armazenamento e segurança">
            Os dados são armazenados em servidores seguros com criptografia em trânsito (HTTPS) e em repouso. Aplicamos boas práticas de segurança para proteger suas informações contra acesso não autorizado.
          </Section>
          <Section titulo="4. Compartilhamento com terceiros">
            Podemos compartilhar dados com prestadores de serviço essenciais para operação do sistema (ex: Asaas para processamento de pagamentos, Railway para hospedagem). Esses parceiros estão sujeitos a obrigações de confidencialidade.
          </Section>
          <Section titulo="5. Retenção de dados">
            Seus dados são mantidos enquanto sua conta estiver ativa. Após o cancelamento, os dados ficam disponíveis por 30 dias e são excluídos permanentemente após esse prazo, salvo obrigação legal de retenção.
          </Section>
          <Section titulo="6. Seus direitos (LGPD)">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigir informações incorretas, solicitar exclusão, portabilidade e revogação de consentimento.
          </Section>
          <Section titulo="7. Cookies">
            Utilizamos apenas cookies essenciais para manter sua sessão autenticada. Não utilizamos cookies de rastreamento ou publicidade.
          </Section>
          <Section titulo="8. Alterações nesta política">
            Podemos atualizar esta Política periodicamente. Notificaremos por e-mail sobre mudanças significativas com pelo menos 15 dias de antecedência.
          </Section>
          <Section titulo="9. Contato">
            Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato pelo e-mail <span className="font-semibold text-slate-800">privacidade@nottacao.com.br</span>.
          </Section>
        </div>

        <div className="mt-8 text-center">
          <Link to="/termos" className="text-sm font-semibold hover:opacity-75 transition-opacity"
                style={{ color: COR }}>
            Ver Termos de Uso →
          </Link>
        </div>
      </main>
    </div>
  );
}
