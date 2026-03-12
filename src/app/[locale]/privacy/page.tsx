import Link from 'next/link';
import { BRAND, ROUTES, FOOTER_LINKS, Shield } from '@/config/ui';
import { constructMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return constructMetadata({
    title: `Privacy Policy — ${BRAND.name}`,
    description: 'Privacy Policy and Personal Data Protection for TempMail',
    path: '/privacy',
    locale: locale as any,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
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
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">นโยบายความเป็นส่วนตัว</h1>
              <p className="text-xs text-text-muted">Privacy Policy</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">ปรับปรุงล่าสุด: {lastUpdated}</p>
        </div>

        <article className="space-y-8 animate-fade-in-up delay-1">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">1</span>
              บทนำ
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>{BRAND.name} (&quot;ผู้ให้บริการ&quot;, &quot;เรา&quot;) ให้บริการแพลตฟอร์มอีเมลชั่วคราวในฐานะตัวกลางทางเทคนิค นโยบายนี้อธิบายแนวทางการจัดการข้อมูลของท่าน (&quot;ผู้ใช้&quot;) เมื่อใช้บริการ</p>
              <p>การใช้บริการถือว่าท่านรับทราบและยินยอมตามนโยบายนี้ หากไม่เห็นด้วย กรุณาหยุดใช้บริการทันที เราสงวนสิทธิ์ในการปรับเปลี่ยนนโยบายนี้ได้ตลอดเวลาตามที่เห็นสมควร</p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">2</span>
              ข้อมูลที่เราเก็บรวบรวม
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-4">
              <p>เราอาจเก็บรวบรวมข้อมูลดังต่อไปนี้ รวมถึงแต่ไม่จำกัดเพียง:</p>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">ข้อมูลที่ท่านให้โดยตรง</h3>
                <ul className="list-disc list-inside space-y-1 text-text-muted">
                  <li>ชื่อหรือชื่อที่แสดง</li>
                  <li>ที่อยู่อีเมลที่ใช้สมัครสมาชิก</li>
                  <li>รหัสผ่าน (จัดเก็บในรูปแบบที่ปลอดภัย)</li>
                  <li>ข้อมูลการชำระเงิน</li>
                  <li>ข้อมูลอื่น ๆ ที่ท่านส่งให้เราโดยสมัครใจ</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">ข้อมูลที่เก็บรวบรวมอัตโนมัติ</h3>
                <ul className="list-disc list-inside space-y-1 text-text-muted">
                  <li>ที่อยู่ IP และข้อมูลการเชื่อมต่อ</li>
                  <li>ประเภทอุปกรณ์ เบราว์เซอร์ และระบบปฏิบัติการ</li>
                  <li>วันเวลา ความถี่ และรูปแบบการใช้งาน</li>
                  <li>ข้อมูล Session และคุกกี้ที่จำเป็น</li>
                  <li>ข้อมูลทางเทคนิคอื่น ๆ ที่จำเป็นต่อการให้บริการ</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">ข้อมูลเกี่ยวกับอีเมลชั่วคราว</h3>
                <ul className="list-disc list-inside space-y-1 text-text-muted">
                  <li>ที่อยู่อีเมลชั่วคราวที่สร้าง</li>
                  <li>ข้อมูลอีเมลที่ได้รับ (จัดเก็บชั่วคราวตามระยะเวลาของแผนบริการ)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">3</span>
              วัตถุประสงค์ในการใช้ข้อมูล
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p className="mb-3">เราใช้ข้อมูลของท่านเพื่อวัตถุประสงค์ดังต่อไปนี้ รวมถึงแต่ไม่จำกัดเพียง:</p>
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ให้บริการ ดูแลรักษา และปรับปรุงแพลตฟอร์ม</li>
                <li>จัดการบัญชีและยืนยันตัวตนผู้ใช้</li>
                <li>ประมวลผลธุรกรรมการชำระเงิน</li>
                <li>รักษาความปลอดภัยของระบบ ป้องกันการใช้งานที่ไม่เหมาะสม</li>
                <li>ตรวจจับและป้องกันพฤติกรรมที่ผิดปกติหรือเป็นอันตราย</li>
                <li>วิเคราะห์ข้อมูลเชิงรวมเพื่อพัฒนาบริการ</li>
                <li>ปฏิบัติตามข้อกำหนดทางกฎหมายและคำสั่งของหน่วยงานที่มีอำนาจ</li>
                <li>ดำเนินการอื่น ๆ ตามที่ผู้ให้บริการเห็นสมควรเพื่อการดำเนินธุรกิจ</li>
              </ul>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">4</span>
              การเปิดเผยและแบ่งปันข้อมูล
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>เราไม่ขายข้อมูลส่วนบุคคลของท่าน แต่เราอาจเปิดเผยข้อมูลให้กับ:</p>
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ผู้ให้บริการที่ทำงานในนามเรา ภายใต้ข้อตกลงรักษาความลับ</li>
                <li>หน่วยงานรัฐหรือผู้มีอำนาจตามกฎหมาย เมื่อได้รับคำร้องขอ</li>
                <li>บุคคลที่สาม ในกรณีที่จำเป็นเพื่อปกป้องสิทธิ ทรัพย์สิน หรือความปลอดภัยของผู้ให้บริการ ผู้ใช้คนอื่น หรือสาธารณะ</li>
                <li>ผู้รับโอนกิจการ ในกรณีควบรวม ซื้อกิจการ หรือการปรับโครงสร้างธุรกิจ</li>
              </ul>
              <p className="text-text-muted mt-2">ทั้งนี้ ผู้ให้บริการจะใช้ดุลยพินิจของตนเองในการพิจารณาว่ากรณีใดจำเป็นต้องเปิดเผยข้อมูล</p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">5</span>
              ระยะเวลาจัดเก็บข้อมูล
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li><strong className="text-text-secondary">อีเมลชั่วคราว:</strong> ลบอัตโนมัติเมื่อครบกำหนดตามแผนบริการที่ท่านเลือกใช้</li>
                <li><strong className="text-text-secondary">ข้อมูลบัญชี:</strong> จัดเก็บตลอดระยะเวลาที่บัญชีมีอยู่ และอาจจัดเก็บต่อหลังลบบัญชีตามระยะเวลาที่จำเป็น</li>
                <li><strong className="text-text-secondary">บันทึกการใช้งาน:</strong> จัดเก็บตามระยะเวลาที่ผู้ให้บริการเห็นสมควร</li>
                <li><strong className="text-text-secondary">ข้อมูลการเงิน:</strong> จัดเก็บตามระยะเวลาที่จำเป็น</li>
              </ul>
              <p className="text-text-muted">ผู้ให้บริการสงวนสิทธิ์ในการจัดเก็บข้อมูลบางส่วนไว้เป็นระยะเวลาที่ยาวนานกว่ากำหนด หากจำเป็นเพื่อการดำเนินธุรกิจ การปฏิบัติตามกฎหมาย หรือการระงับข้อพิพาท</p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">6</span>
              สิทธิของท่าน
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>ท่านอาจร้องขอดำเนินการเกี่ยวกับข้อมูลของท่านได้ดังนี้:</p>
              <ul className="list-disc list-inside space-y-1.5 text-text-muted">
                <li>ขอเข้าถึงข้อมูลส่วนบุคคลของท่าน</li>
                <li>ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                <li>ขอลบข้อมูลส่วนบุคคล</li>
                <li>ขอจำกัดการประมวลผลข้อมูล</li>
                <li>ถอนความยินยอมที่เคยให้ไว้</li>
              </ul>
              <p className="text-text-muted mt-2">ผู้ให้บริการจะพิจารณาคำร้องขอตามที่เห็นสมควร และอาจปฏิเสธคำร้องได้หากมีเหตุอันชอบธรรม เช่น เพื่อรักษาความปลอดภัยของระบบ การปฏิบัติตามกฎหมาย หรือการปกป้องสิทธิของผู้ให้บริการ ติดต่อที่ <strong className="text-brand">dpo@tempmail.dev</strong></p>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">7</span>
              ความปลอดภัย
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p>เราใช้มาตรการรักษาความปลอดภัยตามมาตรฐานอุตสาหกรรมเพื่อปกป้องข้อมูลของท่าน อย่างไรก็ตาม ไม่มีระบบใดที่ปลอดภัยอย่างสมบูรณ์ และผู้ให้บริการไม่สามารถรับประกันความปลอดภัยของข้อมูลได้อย่างสมบูรณ์ ท่านรับทราบและยอมรับความเสี่ยงนี้ในการใช้บริการ</p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">8</span>
              คุกกี้และเทคโนโลยีการติดตาม
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p>เราใช้คุกกี้และเทคโนโลยีที่คล้ายกันเพื่อการทำงานของระบบ ความปลอดภัย และการปรับปรุงบริการ การใช้บริการต่อถือว่าท่านยินยอมให้เราใช้คุกกี้ตามนโยบายนี้</p>
            </div>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">9</span>
              สถานะของผู้ให้บริการ
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed space-y-3">
              <p>{BRAND.name} เป็นเพียงผู้ให้บริการแพลตฟอร์มทางเทคนิคเท่านั้น เราไม่ได้มีส่วนรู้เห็น ควบคุม หรือรับผิดชอบต่อเนื้อหาที่ผ่านระบบ วัตถุประสงค์ในการใช้งานของผู้ใช้ หรือผลที่เกิดจากการใช้บริการ</p>
              <p>เราไม่มีหน้าที่ตรวจสอบ กลั่นกรอง หรือเฝ้าติดตามเนื้อหาอีเมลที่ผ่านระบบ เนื่องจากเป็นข้อมูลส่วนบุคคลของผู้ใช้และการตรวจสอบอาจละเมิดสิทธิความเป็นส่วนตัว</p>
              <p>ผู้ใช้เป็นผู้รับผิดชอบแต่เพียงผู้เดียวต่อการกระทำทั้งหมดที่ดำเนินการผ่านบริการ รวมถึงความถูกต้องเหมาะสมและชอบด้วยกฎหมาย</p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">10</span>
              การโอนข้อมูล
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p>ข้อมูลของท่านอาจถูกจัดเก็บหรือประมวลผลในเซิร์ฟเวอร์ที่ตั้งอยู่ในประเทศต่าง ๆ การใช้บริการถือว่าท่านยินยอมให้มีการโอนข้อมูลข้ามพรมแดนตามที่ผู้ให้บริการเห็นสมควร</p>
            </div>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">11</span>
              การเปลี่ยนแปลงนโยบาย
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p>เราสงวนสิทธิ์ในการแก้ไขนโยบายนี้ได้ตลอดเวลา การเปลี่ยนแปลงมีผลทันทีเมื่อเผยแพร่บนบริการ การใช้บริการต่อหลังการเปลี่ยนแปลง ถือว่าท่านยอมรับนโยบายฉบับปรับปรุงโดยอัตโนมัติ</p>
            </div>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center">12</span>
              ติดต่อเรา
            </h2>
            <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-6 text-sm text-text-secondary leading-relaxed">
              <p className="mb-2">คำถามเกี่ยวกับนโยบายนี้ ติดต่อได้ที่:</p>
              <p className="text-brand font-semibold">dpo@tempmail.dev</p>
              <p className="text-text-muted mt-2">ผู้ให้บริการจะพิจารณาตอบกลับตามที่เห็นสมควร โดยไม่รับประกันระยะเวลาในการตอบกลับ</p>
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
