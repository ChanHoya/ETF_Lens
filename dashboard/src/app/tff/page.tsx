import MainApp from '../../components/MainApp';

export const metadata = {
  title: 'TFF 펀드 현황 대시보드 - ETF Lens',
  description: 'TFF (Time Future Forum) 펀드 투자 현황 및 수익률 대시보드',
};

export default function TffPage() {
  return <MainApp initialTab="tff" showTffTab={true} />;
}
