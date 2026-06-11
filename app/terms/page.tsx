import Link from 'next/link'
import { FileText, Scale, AlertTriangle, Shield, Globe, Ban, Mail, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — SETH',
  description: 'Terms of Service for the Strategic Executive Technology Hub (SETH). Review the terms governing use of the platform.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/seth-logo.png" alt="SETH" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="text-base font-display font-bold tracking-tight">SETH</h1>
              <p className="text-[9px] text-muted-foreground/60 leading-none font-medium uppercase tracking-wider">Strategic Executive Hub</p>
            </div>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title Block */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Terms of Service</h1>
              <p className="text-muted-foreground text-sm">Last Updated: May 25, 2026</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and J Manchester (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing your access to and use of the Strategic Executive Technology Hub (&quot;SETH,&quot; &quot;the Platform,&quot; or &quot;the Service&quot;). By accessing or using SETH, you agree to be bound by these Terms. If you do not agree, you must not access or use the Service.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Scale className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">1. Acceptance of Terms</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>By creating an account, accessing, or using SETH, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which is incorporated herein by reference.</p>
              <p>You represent and warrant that you are at least 18 years of age and have the legal capacity to enter into these Terms. If you are using SETH on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">2. Description of the Service</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>SETH is an AI-powered executive operating system that provides:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Intelligent conversational assistance with privacy-tiered AI model routing</li>
                <li>Task management with autonomous execution capabilities</li>
                <li>Persistent memory and contextual intelligence (Cortex)</li>
                <li>Specialized AI agent delegation (SENTINEL, ARCHITECT, HERALD, PHANTOM, VANGUARD) including multi-agent swarm orchestration</li>
                <li>Brand intelligence monitoring and management</li>
                <li>Web research, calendar integration, email triage, and browser automation</li>
                <li>Voice interaction (speech-to-text and text-to-speech)</li>
                <li>Immersive 3D operational environments</li>
              </ul>
              <p>The Service is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. Features, capabilities, and AI model availability may change as we continue to develop and improve the Platform.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">3. User Accounts</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">3.1 Registration.</strong> To access SETH, you must create an account by providing accurate and complete information. You may register using email and password or through Google Single Sign-On.</p>
              <p><strong className="text-foreground">3.2 Account Security.</strong> You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account or any other breach of security.</p>
              <p><strong className="text-foreground">3.3 One Account per User.</strong> Each account is for a single authorized user. You may not share your account credentials with any other person or entity.</p>
              <p><strong className="text-foreground">3.4 API Keys.</strong> SETH may provide you with API keys for programmatic access. API keys are equivalent to your login credentials and must be kept secure. You are responsible for any activity conducted using your API key.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Ban className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">4. Acceptable Use</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>You agree to use SETH only for lawful purposes and in accordance with these Terms. You shall NOT use the Service to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Violate any applicable federal, state, local, or international law or regulation</li>
                <li>Infringe upon the rights of others, including intellectual property, privacy, or contractual rights</li>
                <li>Transmit any material that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
                <li>Attempt to gain unauthorized access to the Platform, other user accounts, or connected systems</li>
                <li>Interfere with or disrupt the Service, servers, or networks connected to the Service</li>
                <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Platform</li>
                <li>Use the Service to develop a competing product or service</li>
                <li>Circumvent or manipulate SETH&apos;s AI model routing, rate limits, or security controls</li>
                <li>Use automated scripts, bots, or crawlers to access the Service except through authorized API endpoints</li>
                <li>Use the Service in a manner that could harm minors in any way</li>
              </ul>
              <p>We reserve the right to suspend or terminate accounts that violate these provisions without prior notice.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">5. Intellectual Property</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">5.1 Our Intellectual Property.</strong> The Service, including all software, algorithms, designs, text, graphics, logos, and other materials, is owned by J Manchester and is protected by copyright, trademark, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to use the Service in accordance with these Terms.</p>
              <p><strong className="text-foreground">5.2 Your Content.</strong> You retain all ownership rights to the content you create, upload, or input into SETH. By using the Service, you grant us a limited license to process, store, and display your content solely for the purpose of providing the Service to you. We do not claim ownership of your content, and this license terminates when you delete your content or your account.</p>
              <p><strong className="text-foreground">5.3 AI-Generated Output.</strong> Content generated by SETH&apos;s AI in response to your queries is provided for your use. You acknowledge that AI-generated content may not be unique and that similar outputs may be provided to other users making similar queries. We make no claim of ownership over AI-generated outputs.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">6. Privacy &amp; Data Protection</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>Your privacy is paramount. Our collection, use, and protection of your personal information is governed by our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. Key commitments include:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>We will never sell, rent, or trade your personal data</li>
                <li>Your data is encrypted in transit and at rest</li>
                <li>User data is strictly isolated — no cross-user access is possible</li>
                <li>You may request deletion of all your data at any time</li>
                <li>Privacy-preserving AI models are prioritized for your interactions</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">7. Third-Party Services</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>SETH may integrate with or facilitate access to third-party services (e.g., Google Calendar, email providers, web search). Your use of such third-party services is governed by their respective terms and privacy policies. We are not responsible for the practices, content, or availability of third-party services.</p>
              <p>You may connect and disconnect third-party integrations at any time from your SETH settings. Disconnecting an integration immediately revokes SETH&apos;s access to that service.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">8. Disclaimers &amp; Limitations of Liability</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">8.1 AI Output Disclaimer.</strong> SETH provides AI-generated content for informational and assistive purposes only. AI outputs do NOT constitute professional legal, financial, medical, tax, or investment advice. You should always consult qualified professionals before making decisions based on AI-generated information. We make no warranty regarding the accuracy, completeness, reliability, or suitability of AI outputs.</p>
              <p><strong className="text-foreground">8.2 No Warranty.</strong> THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>
              <p><strong className="text-foreground">8.3 Limitation of Liability.</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, J MANCHESTER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
              <p><strong className="text-foreground">8.4 Maximum Liability.</strong> Our total aggregate liability for all claims arising from or related to the Service shall not exceed the total amount you paid us, if any, for the Service during the twelve (12) months preceding the claim.</p>
              <p><strong className="text-foreground">8.5 Autonomous Agent Actions.</strong> SETH&apos;s agents and automation features may take actions on your behalf based on your configured autonomy levels. You are responsible for reviewing and configuring these autonomy settings. We are not liable for actions taken by autonomous agents in accordance with your configured permissions.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">9. Indemnification</h2>
            <div className="text-sm text-muted-foreground leading-relaxed pl-7">
              <p>You agree to indemnify, defend, and hold harmless J Manchester and its affiliates, officers, agents, and employees from and against any claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content you submit, post, or transmit through the Service.</p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">10. Termination</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">10.1 By You.</strong> You may terminate your account at any time by contacting us. Upon termination, your right to use the Service will immediately cease.</p>
              <p><strong className="text-foreground">10.2 By Us.</strong> We may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Grounds for termination include, but are not limited to, violation of these Terms, abusive behavior, or activities that jeopardize the security or integrity of the Platform.</p>
              <p><strong className="text-foreground">10.3 Effect of Termination.</strong> Upon termination, we will delete your data in accordance with our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. Sections of these Terms that by their nature should survive termination will survive, including Sections 5, 8, 9, 11, and 12.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">11. Governing Law &amp; Dispute Resolution</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">11.1 Governing Law.</strong> These Terms shall be governed by and construed in accordance with the laws of the State of Florida, United States, without regard to its conflict-of-law provisions.</p>
              <p><strong className="text-foreground">11.2 Dispute Resolution.</strong> Any dispute arising from or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If the parties are unable to resolve the dispute within thirty (30) days, either party may submit the dispute to binding arbitration in the State of Florida under the rules of the American Arbitration Association (AAA). The arbitration shall be conducted by a single arbitrator, and the arbitrator&apos;s decision shall be final and binding.</p>
              <p><strong className="text-foreground">11.3 Class Action Waiver.</strong> YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.</p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">12. General Provisions</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">12.1 Entire Agreement.</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and us regarding the Service and supersede all prior agreements and understandings.</p>
              <p><strong className="text-foreground">12.2 Severability.</strong> If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
              <p><strong className="text-foreground">12.3 Waiver.</strong> The failure of either party to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</p>
              <p><strong className="text-foreground">12.4 Assignment.</strong> You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations without restriction.</p>
              <p><strong className="text-foreground">12.5 Modifications.</strong> We reserve the right to modify these Terms at any time. Material changes will be communicated through the Platform or via email. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.</p>
              <p><strong className="text-foreground">12.6 Force Majeure.</strong> We shall not be liable for any delay or failure to perform resulting from causes beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, epidemics, power outages, or internet service provider failures.</p>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">13. Contact Information</h2>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed pl-7">
              <p className="mb-3">For questions about these Terms, please contact us:</p>
              <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
                <p><strong className="text-foreground">J Manchester</strong></p>
                <p>Email: <a href="mailto:jmanchester@proton.me" className="text-primary hover:underline">jmanchester@proton.me</a></p>
                <p>Jurisdiction: State of Florida, United States</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
          <p>© 2026 J Manchester. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
