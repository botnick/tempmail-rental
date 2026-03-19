import Link from 'next/link';
import { BRAND, ROUTES, FOOTER_LINKS, FileText } from '@/config/ui';
import { constructMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return constructMetadata({
    title: `Terms of Service — ${BRAND.name}`,
    description: 'Terms of Service for TempMail temporary email platform',
    path: '/terms',
    locale: locale as any,
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const Logo = BRAND.Logo;
  const lastUpdated = '11 มีนาคม 2569';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg" />
      <div className="noise-overlay" />

      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <Link href={ROUTES.home} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center shadow-lg shadow-brand/20 transition-transform duration-300 group-hover:scale-110">
            <Logo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">{BRAND.name}</span>
        </Link>
        <Link href={ROUTES.login} className="px-5 py-2 text-sm font-semibold text-brand border border-brand/30 rounded-xl hover:bg-brand/10 transition-all duration-300">
          เข้าสู่ระบบ
        </Link>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="animate-fade-in-up mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">เงื่อนไขการใช้งาน</h1>
              <p className="text-xs text-text-muted">Terms of Service</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">ปรับปรุงล่าสุด: {lastUpdated}</p>
        </div>

        <article className="space-y-8 animate-fade-in-up delay-1">

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">1</span>
              ข้อตกลงทั่วไป
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>เมื่อท่านสมัครสมาชิกหรือใช้บริการ {BRAND.name} ถือว่าท่านยอมรับเงื่อนไขฉบับนี้แล้ว หากไม่เห็นด้วย กรุณาหยุดใช้บริการ</p>
              <p>{BRAND.name} เป็นผู้ให้บริการแพลตฟอร์มอีเมลชั่วคราว เราทำหน้าที่เป็นตัวกลางทางเทคนิคเท่านั้น ไม่ได้มีส่วนรู้เห็นหรือควบคุมเนื้อหาที่ผ่านระบบ</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">2</span>
              คุณสมบัติผู้ใช้
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ท่านต้องมีอายุตามที่กฎหมายกำหนด หากเป็นผู้เยาว์ต้องได้รับอนุญาตจากผู้ปกครอง</li>
                <li>ท่านต้องให้ข้อมูลที่ถูกต้องในการสมัครสมาชิก</li>
                <li>หนึ่งคนสามารถมีได้หนึ่งบัญชีเท่านั้น</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">3</span>
              สิ่งที่เราให้บริการ
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>เราให้บริการอีเมลชั่วคราวสำหรับการใช้งานที่ถูกต้อง เช่น:</p>
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ปกป้องอีเมลหลักจากสแปมเมื่อสมัครบริการออนไลน์</li>
                <li>ทดสอบระบบโดยนักพัฒนา</li>
                <li>รับรหัสยืนยันชั่วคราว</li>
                <li>รักษาความเป็นส่วนตัว</li>
              </ul>
              <p>จำนวนกล่องจดหมาย ระยะเวลาจัดเก็บ และฟีเจอร์ ขึ้นอยู่กับแผนบริการที่ท่านเลือก ดูรายละเอียดที่<Link href={ROUTES.pricing} className="text-brand hover:underline ml-1">หน้าแผนราคา</Link></p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">4</span>
              ข้อห้าม
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p className="font-semibold text-text-primary">ห้ามใช้บริการเพื่อ:</p>
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>กิจกรรมผิดกฎหมายทุกรูปแบบ</li>
                <li>ส่งหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย คุกคาม หรือหมิ่นประมาท</li>
                <li>ฉ้อโกง หลอกลวง หรือแอบอ้างเป็นบุคคลอื่น</li>
                <li>ฟิชชิ่ง (Phishing) หรือหลอกให้เปิดเผยข้อมูลส่วนตัว</li>
                <li>เผยแพร่ไวรัสหรือซอฟต์แวร์ที่เป็นอันตราย</li>
                <li>ส่งอีเมลขยะจำนวนมาก</li>
                <li>ละเมิดทรัพย์สินทางปัญญาของผู้อื่น</li>
                <li>พยายามเข้าถึงระบบหรือบัญชีที่ไม่ได้รับอนุญาต</li>
                <li>ใช้บอทหรือระบบอัตโนมัติเกินกว่า API Limit ที่กำหนด</li>
              </ul>
              <p className="text-warning text-xs font-semibold mt-2">การฝ่าฝืนอาจส่งผลให้บัญชีถูกระงับทันทีโดยไม่ต้องแจ้งล่วงหน้า และเราอาจรายงานข้อมูลที่เกี่ยวข้องไปยังหน่วยงานที่มีอำนาจตามที่เราเห็นสมควร</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">5</span>
              บัญชีและความปลอดภัย
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ท่านรับผิดชอบในการรักษารหัสผ่านให้ปลอดภัย</li>
                <li>ท่านรับผิดชอบต่อกิจกรรมทั้งหมดที่เกิดขึ้นผ่านบัญชีของท่าน</li>
                <li>แจ้งเราทันทีที่ support@tempmail.dev หากพบการใช้บัญชีโดยไม่ได้รับอนุญาต</li>
                <li>ห้ามแบ่งปันรหัสผ่านหรือข้อมูลบัญชีกับผู้อื่น</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">6</span>
              การชำระเงินและการคืนเงิน
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>แผนฟรีไม่มีค่าใช้จ่าย</li>
                <li>แผนชำระเงินเรียกเก็บรายเดือน ราคาแสดงเป็นบาท (รวม VAT แล้ว)</li>
                <li>ต่ออายุอัตโนมัติ เว้นแต่ท่านยกเลิกก่อนวันหมดอายุ</li>
                <li>ยกเลิกได้ตลอดเวลาผ่านหน้าตั้งค่า จะมีผลเมื่อสิ้นสุดรอบบิลปัจจุบัน</li>
                <li>การขอคืนเงินเป็นไปตามเงื่อนไขที่ผู้ให้บริการกำหนด ณ ขณะนั้น</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">7</span>
              ทรัพย์สินทางปัญญา
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>แบรนด์ โลโก้ ซอฟต์แวร์ และเนื้อหาของ {BRAND.name} เป็นทรัพย์สินของผู้ให้บริการ</li>
                <li>เนื้อหาอีเมลที่ท่านได้รับยังคงเป็นของเจ้าของเนื้อหานั้น</li>
                <li>ห้ามทำซ้ำหรือดัดแปลงทรัพย์สินของเราโดยไม่ได้รับอนุญาต</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">8</span>
              ข้อจำกัดความรับผิดชอบ
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>บริการให้ &quot;ตามที่เป็น&quot; (As Is) โดยไม่มีการรับประกันใด ๆ ทั้งทางตรงและทางอ้อม</li>
                <li>{BRAND.name} เป็นเพียงผู้ให้บริการแพลตฟอร์ม ไม่ได้มีส่วนรู้เห็น ควบคุม ตรวจสอบ หรือรับผิดชอบต่อเนื้อหา การกระทำ หรือวัตถุประสงค์ในการใช้งานของผู้ใช้</li>
                <li>ผู้ใช้เป็นผู้รับผิดชอบแต่เพียงผู้เดียวต่อการกระทำทั้งหมดที่ดำเนินการผ่านบริการ รวมถึงความถูกต้องตามกฎหมายของการใช้งาน</li>
                <li>เราไม่มีหน้าที่และไม่สามารถตรวจสอบเนื้อหาอีเมลที่ผ่านระบบ เนื่องจากเป็นข้อมูลส่วนบุคคลของผู้ใช้</li>
                <li>เราไม่รับผิดชอบต่อข้อมูลที่สูญหายหลังหมดอายุตามระยะเวลาที่กำหนด</li>
                <li>ความรับผิดรวมสูงสุดของเราไม่เกินค่าบริการที่ท่านชำระในช่วงเวลาที่ผ่านมาตามที่ผู้ให้บริการกำหนด</li>
                <li>เราสงวนสิทธิ์ในการให้ความร่วมมือกับหน่วยงานที่มีอำนาจเมื่อได้รับคำร้องอย่างเป็นทางการ</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">9</span>
              การระงับบัญชี
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>เราสงวนสิทธิ์ระงับหรือยกเลิกบัญชีที่ฝ่าฝืนเงื่อนไข</li>
                <li>ท่านสามารถลบบัญชีได้ตลอดเวลาผ่านหน้าตั้งค่า</li>
                <li>ข้อมูลจะถูกลบภายในระยะเวลาที่เหมาะสมหลังลบบัญชี ยกเว้นข้อมูลที่ผู้ให้บริการจำเป็นต้องเก็บรักษา</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">10</span>
              การเปลี่ยนแปลงเงื่อนไข
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p>เราอาจแก้ไขเงื่อนไขเป็นครั้งคราว หากมีการเปลี่ยนแปลงสำคัญ จะแจ้งให้ทราบล่วงหน้าผ่านอีเมลหรือการแจ้งเตือนในระบบ</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">11</span>
              ติดต่อ
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p className="mb-2">คำถามเกี่ยวกับเงื่อนไขนี้ ติดต่อได้ที่:</p>
              <p className="text-brand font-semibold">legal@tempmail.dev</p>
              <p className="text-text-muted mt-2">หรือผ่าน<Link href={ROUTES.contact} className="text-brand hover:underline ml-1">หน้าติดต่อเรา</Link></p>
            </div>
          </section>
        </article>
      </main>

      <footer className="relative z-10 border-t border-border-subtle px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href={ROUTES.home} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center"><Logo className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-bold text-sm text-gradient">{BRAND.name}</span>
          </Link>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            {FOOTER_LINKS.map((link) => (<Link key={link.label} href={link.href} className="hover:text-text-secondary transition-colors">{link.label}</Link>))}
          </div>
          <div className="text-xs text-text-muted/50">{BRAND.copyright}</div>
        </div>
      </footer>
    </div>
  );
}
