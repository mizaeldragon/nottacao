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

export default function Termos() {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-2">Termos de Uso</h1>
          <p className="text-slate-400 text-sm">Última atualização: junho de 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
          <Section titulo="1. Aceitação dos termos">
            Ao acessar ou utilizar o sistema nottação, você concorda com estes Termos de Uso. Se não concordar com qualquer parte destes termos, não utilize o serviço.
          </Section>
          <Section titulo="2. Descrição do serviço">
            O nottação é um software de gestão (SaaS) destinado a borracharias, oferecendo controle de serviços, caixa, estoque, clientes e financeiro. O acesso é fornecido mediante assinatura mensal.
          </Section>
          <Section titulo="3. Cadastro e conta">
            Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas as atividades realizadas na sua conta. Notifique-nos imediatamente em caso de uso não autorizado.
          </Section>
          <Section titulo="4. Assinatura e pagamento">
            O plano custa R$ 200,00 por mês por estabelecimento, cobrado via Asaas (Pix, boleto ou cartão). O acesso fica suspenso em caso de inadimplência, e nenhum dado é apagado durante o período de suspensão.
          </Section>
          <Section titulo="5. Propriedade dos dados">
            Todos os dados inseridos no sistema (clientes, serviços, movimentações) são de sua propriedade. O nottação não compartilha nem vende seus dados a terceiros.
          </Section>
          <Section titulo="6. Disponibilidade">
            Nos esforçamos para manter o sistema disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência.
          </Section>
          <Section titulo="7. Limitação de responsabilidade">
            O nottação não se responsabiliza por perdas financeiras decorrentes de uso indevido do sistema, falhas de terceiros (pagamentos, infraestrutura) ou força maior.
          </Section>
          <Section titulo="8. Cancelamento">
            Você pode cancelar sua assinatura a qualquer momento. O acesso permanece ativo até o fim do período já pago. Após o cancelamento, os dados ficam disponíveis por 30 dias para exportação.
          </Section>
          <Section titulo="9. Alterações nos termos">
            Podemos atualizar estes Termos periodicamente. Usuários serão notificados por e-mail com pelo menos 15 dias de antecedência antes de qualquer alteração significativa entrar em vigor.
          </Section>
          <Section titulo="10. Contato">
            Dúvidas sobre estes Termos? Entre em contato pelo e-mail <span className="font-semibold text-slate-800">suporte@nottacao.com.br</span>.
          </Section>
        </div>

        <div className="mt-8 text-center">
          <Link to="/privacidade" className="text-sm font-semibold hover:opacity-75 transition-opacity"
                style={{ color: COR }}>
            Ver Política de Privacidade →
          </Link>
        </div>
      </main>
    </div>
  );
}
