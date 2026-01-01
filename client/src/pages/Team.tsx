import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Users, Copy, QrCode, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { REFERRAL_REWARDS_TABLE } from "../../../shared/referral-config";
import { useAuth } from "@/contexts/AuthContext";

export default function Team() {
  const { user } = useAuth();
  const userId = user?.id?.toString() || '';
  
  const { data: referralInfo, isLoading: isLoadingReferral } = trpc.referral.info.useQuery(
    { userId },
    { enabled: !!userId }
  );
  const { data: team, isLoading: isLoadingTeam } = trpc.referral.team.useQuery(
    { userId },
    { enabled: !!userId }
  );

  const copyLink = () => {
    if (referralInfo?.referralLink) {
      navigator.clipboard.writeText(referralInfo.referralLink);
      toast.success('تم نسخ رابط الإحالة');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="فريقي" subtitle="دعوة الأصدقاء واكسب العمولات" />
      
      <div className="container max-w-lg mx-auto py-6">
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h3 className="font-bold text-foreground mb-4">رمز الإحالة الخاص بك</h3>
          
          {/* عرض الرمز */}
          <div className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-4 mb-3 border-2 border-primary/30">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">رمزك</div>
              {isLoadingReferral ? (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (
                <div className="text-4xl font-mono font-bold text-primary tracking-wider">
                  {referralInfo?.referralCode || '------'}
                </div>
              )}
            </div>
          </div>
          
          {/* عرض الرابط */}
          <div className="bg-secondary rounded-lg p-4 mb-3">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">رابط الدعوة</div>
              {isLoadingReferral ? (
                <div className="flex justify-center">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              ) : (
                <div className="text-xs text-foreground break-all font-mono">
                  {referralInfo?.referralLink || 'لم يتم إنشاء الرابط'}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={copyLink} 
              disabled={isLoadingReferral || !referralInfo?.referralLink}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-4 h-4" />
              نسخ الرابط
            </button>
            <button className="flex items-center justify-center gap-2 bg-secondary text-foreground rounded-lg py-3">
              <QrCode className="w-4 h-4" />
              QR Code
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-primary" style={{ fontFamily: 'monospace' }}>
              {isLoadingTeam ? (
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" />
              ) : (
                team?.level1 || 0
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">المستوى 1</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-primary" style={{ fontFamily: 'monospace' }}>
              {isLoadingTeam ? (
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" />
              ) : (
                team?.level2 || 0
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">المستوى 2</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-primary" style={{ fontFamily: 'monospace' }}>
              {isLoadingTeam ? (
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" />
              ) : (
                team?.level3 || 0
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">المستوى 3</div>
          </div>
        </div>

        <div className="bg-secondary/50 border border-border rounded-lg p-4 text-center mb-6">
          <Users className="w-10 h-10 mx-auto mb-2 text-primary" />
          <h4 className="font-bold text-foreground mb-2">إجمالي الفريق</h4>
          <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'monospace' }}>
            {isLoadingTeam ? (
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            ) : (
              team?.total || 0
            )}
          </div>
        </div>

        {/* جدول المكافآت */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">مكافآت توصية الفريق</h3>
          </div>
          
          {/* شرح النظام */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
            <p className="text-blue-900 mb-2">
              <span className="font-bold">EMP-1:</span> يحصل على عمولة فورية للإحالات المباشرة، ويحصل EMP2 على فوائد تراكمية من المستوى الثاني.
            </p>
            <p className="text-blue-900 mb-2">
              <span className="font-bold">EMP-2:</span> يحصل EMP3 على مكافآت من المستوى الثالث لتضخيم الأرباح.
            </p>
            <p className="text-blue-900">
              ونظام التوصية المتشعب ثلاثي المستويات يجعل كل توصية ذات قيمة!
            </p>
          </div>

          {/* الجدول */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100">
                  <th className="p-2 text-center font-bold text-blue-900">USDT</th>
                  <th className="p-2 text-center font-bold text-blue-900">EMP1-7%</th>
                  <th className="p-2 text-center font-bold text-blue-900">EMP2-2%</th>
                  <th className="p-2 text-center font-bold text-blue-900">EMP3-1%</th>
                </tr>
              </thead>
              <tbody>
                {REFERRAL_REWARDS_TABLE.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2 text-center font-bold text-blue-900">{row.amount}</td>
                    <td className="p-2 text-center text-blue-900">{row.emp1.toFixed(2)}</td>
                    <td className="p-2 text-center text-blue-900">{row.emp2.toFixed(2)}</td>
                    <td className="p-2 text-center text-blue-900">{row.emp3.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ملاحظات */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="bg-green-50 border border-green-200 rounded p-2 text-green-900">
              <span className="font-bold">✓</span> يمكنك الحصول على مكافأة 7% على أول إيداع لمستخدمي EMP-1 في فريقك.
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-2 text-green-900">
              <span className="font-bold">✓</span> يمكنك الحصول على مكافأة 2% على أول إيداع لمستخدمي EMP-2 في فريقك.
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-2 text-green-900">
              <span className="font-bold">✓</span> يمكنك الحصول على مكافأة 1% على أول إيداع لمستخدمي EMP-3 في فريقك.
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
