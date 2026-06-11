import Link from 'next/link'
import { Shield, Lock, Eye, Server, Globe, Mail, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — SETH',
  description: 'Privacy Policy for the Strategic Executive Technology Hub (SETH). Learn how we protect your data with enterprise-grade security and privacy-first architecture.',
}

export default function PrivacyPolicyPage() {
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
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Privacy Policy</h1>
              <p className="text-muted-foreground text-sm">Last Updated: May 25, 2026</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm leading-relaxed">
              At SETH, privacy is not a feature — it is the foundation. This policy describes how J Manchester (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, protects, and handles your information when you use the Strategic Executive Technology Hub (&quot;SETH,&quot; &quot;the Platform,&quot; or &quot;the Service&quot;). We are committed to the highest standards of data protection and operational security for every user.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">1. Our Privacy-First Philosophy</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>
                SETH was purpose-built for executives and organizations who operate with sensitive, high-stakes information. We designed every layer of the platform around a core principle: <strong className="text-foreground">your data belongs to you</strong>. We do not monetize your data, sell it to third parties, or use it for advertising of any kind.
              </p>
              <p>Our privacy architecture includes:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Privacy-Tiered AI Processing:</strong> SETH&apos;s intelligent model router prioritizes privacy-preserving AI models for standard interactions, escalating to premium models only when task complexity demands it — and never without your data being protected in transit and at rest.</li>
                <li><strong className="text-foreground">Isolated User Environments:</strong> All data, memories, conversations, agent configurations, and brand intelligence are strictly partitioned per user. No cross-user data leakage is architecturally possible.</li>
                <li><strong className="text-foreground">Operational Security by Design:</strong> The PHANTOM agent within SETH is dedicated to operational security, digital footprint management, and threat assessment — privacy protection is woven into the product itself.</li>
                <li><strong className="text-foreground">Zero Advertising, Zero Data Brokering:</strong> We will never sell, rent, trade, or otherwise commercially exploit your personal information or usage data.</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Eye className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">2. Information We Collect</h2>
            </div>
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed pl-7">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">2.1 Account Information</h3>
                <p>When you create an account, we collect your name, email address, and a securely hashed password. If you authenticate via Google Single Sign-On (SSO), we receive your name, email, and profile identifier from Google. We do not store your Google password.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">2.2 User-Provided Content</h3>
                <p>This includes all content you voluntarily provide to SETH: conversation messages, tasks, memories, brand profiles, agent configurations, calendar entries, automation rules, uploaded files, and profile preferences (objectives, working style, etc.). This content is stored to provide you with the Service and is never shared with other users or third parties.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">2.3 Automatically Collected Information</h3>
                <p>We collect minimal technical data necessary for platform operation:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1.5">
                  <li><strong className="text-foreground">Session Data:</strong> Authentication tokens and session identifiers to maintain your secure login state.</li>
                  <li><strong className="text-foreground">Geolocation (Optional):</strong> If you grant permission, approximate location data to provide contextually relevant assistance (e.g., local weather, timezone-aware scheduling). This is never stored permanently and can be revoked at any time through your browser settings.</li>
                  <li><strong className="text-foreground">Telemetry:</strong> Anonymized, aggregated platform performance metrics (response latency, model routing statistics, tool usage counts) used solely to improve service quality. This data cannot be traced back to individual users or conversations.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">2.4 Information We Do NOT Collect</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>We do not use cookies for tracking or advertising.</li>
                  <li>We do not collect browsing history outside the Platform.</li>
                  <li>We do not employ third-party analytics trackers, pixels, or fingerprinting technologies.</li>
                  <li>We do not monitor keystrokes, clipboard data, or screen content outside of explicit Platform interactions.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Server className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">3. How We Use Your Information</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>Your information is used exclusively to operate and improve the Service:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Service Delivery:</strong> To provide AI-assisted chat, task management, memory recall, agent delegation, brand intelligence, and all other Platform features.</li>
                <li><strong className="text-foreground">Personalization:</strong> To tailor SETH&apos;s responses and behavior to your stated objectives, preferences, and working style — all configured and controlled by you.</li>
                <li><strong className="text-foreground">Cortex Intelligence:</strong> SETH&apos;s Cortex system identifies patterns, contradictions, and insights within <em>your own</em> data to provide proactive intelligence. This analysis is performed exclusively on your data and is never commingled with other users&apos; information.</li>
                <li><strong className="text-foreground">Security &amp; Integrity:</strong> To authenticate your identity, protect against unauthorized access, and maintain the integrity of the Platform.</li>
                <li><strong className="text-foreground">Service Improvement:</strong> To diagnose technical issues and improve platform reliability using anonymized, aggregated metrics only.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">4. AI Processing &amp; Third-Party Services</h2>
            </div>
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>
                SETH utilizes artificial intelligence models to process your requests. We are transparent about how your data interacts with these systems:
              </p>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">4.1 AI Model Providers</h3>
                <p>Depending on task complexity, your queries may be processed by:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1.5">
                  <li><strong className="text-foreground">Privacy-Tier Models:</strong> For standard interactions, SETH routes requests through privacy-optimized AI providers that do not retain, log, or train on your data.</li>
                  <li><strong className="text-foreground">Premium-Tier Models:</strong> For complex analytical tasks, premium AI models may be utilized. These providers process your data solely to generate a response and do not retain it after processing.</li>
                </ul>
                <p className="mt-2">All data transmitted to AI providers is encrypted in transit via TLS 1.2 or higher. We contractually require that no AI provider retains, trains on, or redistributes your data.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">4.2 Voice Processing</h3>
                <p>If you use voice input or text-to-speech features, audio data is transmitted to secure voice processing services exclusively for transcription or speech synthesis. Audio data is processed in real-time and is not stored by these providers after the response is delivered.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">4.3 Authentication</h3>
                <p>If you choose to authenticate via Google SSO, we interact with Google&apos;s OAuth 2.0 service solely to verify your identity. We receive only your basic profile information (name, email) and, if you connect your Google account for Calendar or Email features, a revocable access token. You may disconnect Google integration at any time from your SETH settings.</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">5. Data Security</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>We implement comprehensive security measures to protect your information:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Encryption in Transit:</strong> All data transmitted between your device and our servers is encrypted using TLS (Transport Layer Security) protocols.</li>
                <li><strong className="text-foreground">Encryption at Rest:</strong> Stored data is encrypted using industry-standard AES-256 encryption.</li>
                <li><strong className="text-foreground">Password Security:</strong> User passwords are never stored in plaintext. We use bcrypt hashing with salt rounds, making password reversal computationally infeasible.</li>
                <li><strong className="text-foreground">Session Management:</strong> Secure, httpOnly, encrypted session tokens with automatic expiration protect against session hijacking and cross-site scripting (XSS) attacks.</li>
                <li><strong className="text-foreground">Access Controls:</strong> Strict server-side authentication and authorization on every API endpoint ensures that only authenticated users can access their own data. Every data request is validated against the authenticated user&apos;s identity — no data is accessible by URL manipulation or parameter tampering.</li>
                <li><strong className="text-foreground">Input Validation:</strong> All user inputs are validated and sanitized to protect against injection attacks and malformed data.</li>
                <li><strong className="text-foreground">Infrastructure Security:</strong> Our hosting infrastructure employs network isolation, automated threat monitoring, and regular security updates.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">6. Data Retention &amp; Deletion</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>We retain your data only for as long as necessary to provide the Service or as required by law:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Active Data:</strong> Your conversations, memories, tasks, and configurations are retained for as long as your account is active.</li>
                <li><strong className="text-foreground">Memory Decay:</strong> SETH&apos;s Cortex system includes intelligent memory decay — low-importance, stale memories are automatically flagged and can be archived or removed, ensuring your data footprint does not grow unboundedly.</li>
                <li><strong className="text-foreground">Account Deletion:</strong> You may request complete deletion of your account and all associated data at any time by contacting us. Upon receiving a verified deletion request, we will permanently remove all your data from our active systems within 30 days and from any backups within 90 days.</li>
                <li><strong className="text-foreground">Conversation Deletion:</strong> You may delete individual conversations at any time from within the Platform. Deleted conversations and their associated messages are immediately and permanently removed.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">7. Data Sharing &amp; Disclosure</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p><strong className="text-foreground">We do not sell, rent, or trade your personal information.</strong> We will only disclose your information in the following limited circumstances:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Service Providers:</strong> With AI model providers and infrastructure partners strictly necessary to operate the Platform, under contractual obligations to protect your data and use it solely for service delivery.</li>
                <li><strong className="text-foreground">Legal Compliance:</strong> If required by law, regulation, legal process, or enforceable governmental request, we may disclose information as necessary. We will notify you of such requests to the extent permitted by law.</li>
                <li><strong className="text-foreground">Protection of Rights:</strong> To enforce our Terms of Service, protect the safety of our users, or protect our legal rights when we believe in good faith that such action is necessary.</li>
                <li><strong className="text-foreground">Business Transfer:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred to the successor entity. We will notify you of any such transfer and any changes to this Privacy Policy.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">8. Your Rights</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-7">
              <p>You have the following rights regarding your personal data:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Access:</strong> You may request a copy of all personal data we hold about you.</li>
                <li><strong className="text-foreground">Correction:</strong> You may update or correct your personal information at any time through your Profile settings.</li>
                <li><strong className="text-foreground">Deletion:</strong> You may request deletion of your account and all associated data.</li>
                <li><strong className="text-foreground">Data Portability:</strong> You may request an export of your data in a machine-readable format.</li>
                <li><strong className="text-foreground">Revoke Consent:</strong> You may withdraw consent for optional data collection (e.g., geolocation, Google integration) at any time without affecting the core functionality of the Service.</li>
                <li><strong className="text-foreground">Opt Out:</strong> You may opt out of non-essential data processing by adjusting your settings within the Platform.</li>
              </ul>
              <p className="mt-2">For residents of Florida and other U.S. states with comprehensive privacy legislation, you may also have additional rights, including the right to know what categories of personal information are collected and the right to non-discrimination for exercising your privacy rights. To exercise any of these rights, please contact us at the address provided below.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">9. Children&apos;s Privacy</h2>
            <div className="text-sm text-muted-foreground leading-relaxed pl-7">
              <p>SETH is designed for business professionals and is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a user is under 18, we will promptly delete their account and all associated data.</p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-display font-semibold mb-4 pl-7">10. Changes to This Policy</h2>
            <div className="text-sm text-muted-foreground leading-relaxed pl-7">
              <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make material changes, we will notify you by posting a prominent notice within the Platform or by email. The &quot;Last Updated&quot; date at the top of this page indicates when this policy was last revised. Your continued use of the Service after any changes constitutes your acceptance of the updated policy.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-semibold">11. Contact Us</h2>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed pl-7">
              <p className="mb-3">If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
              <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
                <p><strong className="text-foreground">J Manchester</strong></p>
                <p>Email: <a href="mailto:jmanchester@proton.me" className="text-primary hover:underline">jmanchester@proton.me</a></p>
                <p>Jurisdiction: State of Florida, United States</p>
              </div>
              <p className="mt-3">We will respond to all legitimate privacy inquiries within 30 days.</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
          <p>© 2026 J Manchester. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
