import Link from "next/link";

export default function PlimsollLanding() {
  return (
    <main className="min-h-screen bg-paper text-ink selection:bg-terracotta selection:text-paper relative overflow-hidden">

      {/* BACKGROUND GRAPH PAPER GRID */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#1A1918 1px, transparent 1px), linear-gradient(90deg, #1A1918 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex flex-col min-h-screen">

        {/* NAV BAR */}
        <header className="flex justify-between items-center border-b border-ink/30 pb-6 mb-24">
          <div className="flex items-center gap-4">
            <span className="font-serif text-2xl tracking-tight text-terracotta">&#x29B5;</span>
            <span className="font-serif text-2xl tracking-tight">Plimsoll</span>
          </div>
          <div className="flex gap-8 font-mono text-xs uppercase tracking-widest text-ink/70">
            <Link href="https://github.com/scoootscooob/plimsoll-protocol" className="hover:text-terracotta transition-colors hidden md:block">Source_Code</Link>
            <Link href="https://github.com/scoootscooob/plimsoll-protocol#readme" className="hover:text-terracotta transition-colors hidden md:block">Whitepaper</Link>
            <Link href="/dashboard" className="text-ink hover:text-terracotta transition-colors border-l border-ink/30 pl-8">
              [ Init_Fleet_Command ]
            </Link>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="flex flex-col justify-center max-w-5xl mb-32">
          <p className="font-mono text-terracotta text-xs mb-8 tracking-widest uppercase border-l-2 border-terracotta pl-4">
            Sys.Ref: Craton_V1 // Formal Execution Physics
          </p>

          <h1 className="text-6xl md:text-8xl font-serif leading-[1.05] tracking-tight mb-10">
            Intelligence is <span className="italic text-ink/60">probabilistic.</span><br />
            Capital is <span className="underline decoration-1 underline-offset-8">deterministic.</span>
          </h1>

          <p className="font-mono text-base md:text-lg text-ink/80 leading-relaxed max-w-2xl mb-12">
            Plimsoll is the architectural bridge between feral AI intent and rigid on-chain execution.
            We translate stochastic hallucinations into absolute mathematical invariants.
          </p>

          {/* CALL TO ACTIONS */}
          <div className="flex flex-col sm:flex-row gap-6 font-mono text-sm">
            <Link href="/dashboard"
                   className="border border-ink bg-ink text-paper px-8 py-4 uppercase tracking-wider hover:bg-terracotta hover:border-terracotta transition-all text-center rounded-none shadow-[4px_4px_0px_0px_rgba(200,75,49,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
              Deploy Substrate &#x2197;
            </Link>
            <Link href="https://github.com/scoootscooob/plimsoll-protocol#readme"
                   className="border border-ink bg-transparent text-ink px-8 py-4 uppercase tracking-wider hover:bg-ink/5 transition-all text-center rounded-none shadow-[4px_4px_0px_0px_rgba(26,25,24,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
              Read the Math
            </Link>
          </div>
        </section>

        {/* THE 3 INVARIANTS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-ink/30 mb-32">

          <div className="border-r border-b border-ink/30 p-10 bg-paper hover:bg-surface transition-colors">
            <h3 className="font-mono text-xs text-terracotta mb-6 tracking-widest uppercase">[ Invariant_01 ]</h3>
            <h2 className="font-serif text-3xl mb-4">Velocity Limits.</h2>
            <p className="font-mono text-sm text-ink/70 leading-relaxed">
              Cryptographically bound the maximum USD value an agent can move per tick.
              Prevent catastrophic drain prior to state transition.
            </p>
          </div>

          <div className="border-r border-b border-ink/30 p-10 bg-paper hover:bg-surface transition-colors">
            <h3 className="font-mono text-xs text-terracotta mb-6 tracking-widest uppercase">[ Invariant_02 ]</h3>
            <h2 className="font-serif text-3xl mb-4">Semantic Reverts.</h2>
            <p className="font-mono text-sm text-ink/70 leading-relaxed">
              We do not crash agents. Blocked transactions are returned to the LLM
              observation loop as actionable JSON directives to self-correct.
            </p>
          </div>

          <div className="border-r border-b border-ink/30 p-10 bg-paper hover:bg-surface transition-colors">
            <h3 className="font-mono text-xs text-terracotta mb-6 tracking-widest uppercase">[ Invariant_03 ]</h3>
            <h2 className="font-serif text-3xl mb-4">Hardware Isolation.</h2>
            <p className="font-mono text-sm text-ink/70 leading-relaxed">
              Execution signatures never touch the host OS. Session keys are generated
              and constrained entirely within AWS Nitro Enclaves.
            </p>
          </div>
        </section>

        {/* SOTA MODELS: THE PROOF */}
        <section className="mb-32 border border-ink/30 bg-paper">
          <div className="border-b border-ink/30 px-10 py-6">
            <h3 className="font-mono text-xs text-terracotta mb-2 tracking-widest uppercase">[ Lab_Results ]</h3>
            <h2 className="font-serif text-4xl">Every frontier model breaks.</h2>
          </div>
          <div className="px-10 py-8">
            <p className="font-mono text-sm text-ink/70 leading-relaxed mb-8 max-w-2xl">
              We run the same multi-vector prompt injection against every SOTA model with
              tool-calling capability. The system prompt includes explicit security guidelines.
              Every model ignores its own safety instructions. Only deterministic math stops it.
            </p>
            <div className="font-mono text-sm bg-ink text-paper/80 p-8 border border-ink shadow-[8px_8px_0px_0px_rgba(200,75,49,1)]">
              <div className="text-ink/50 mb-4">// Identical attack, three frontier models</div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2">
                <div className="text-paper/50">MODEL</div>
                <div className="text-paper/50">UNPROTECTED</div>
                <div className="text-paper/50">WITH PLIMSOLL</div>

                <div>GPT-5.2</div>
                <div className="text-terracotta">COMPROMISED</div>
                <div className="text-green-400">PROTECTED</div>

                <div>Gemini 3.1 Pro</div>
                <div className="text-terracotta">COMPROMISED</div>
                <div className="text-green-400">PROTECTED</div>

                <div>Claude Opus 4.6</div>
                <div className="text-terracotta">COMPROMISED</div>
                <div className="text-green-400">PROTECTED</div>
              </div>
              <div className="mt-6 text-ink/40">
                9 sends each &middot; $10,501 drained each &middot; 0 bypasses with Plimsoll
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATION SECTION (CODE BLOCK) */}
        <section className="mb-32 flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1">
            <h3 className="font-mono text-xs text-terracotta mb-6 tracking-widest uppercase">[ Integration ]</h3>
            <h2 className="font-serif text-4xl mb-6">Zero-friction compliance.</h2>
            <p className="font-mono text-sm text-ink/70 leading-relaxed mb-8">
              Wrap feral AI agents in unbreakable execution physics using a single
              line of code. Natively compatible with OpenClaw, Automaton, Eliza,
              and LangChain.
            </p>
          </div>
          <div className="flex-1 w-full bg-ink p-8 font-mono text-sm text-paper/80 border border-ink shadow-[8px_8px_0px_0px_rgba(200,75,49,1)]">
            <div className="text-terracotta mb-4"># Plimsoll natively wraps OpenClaw agents</div>
            <div>
              <span className="text-terracotta">from</span> plimsoll.integrations.openclaw <span className="text-terracotta">import</span> PlimsollTools
            </div>
            <br />
            <div>agent = Agent(</div>
            <div className="pl-4">model=<span className="text-paper">&quot;gpt-4&quot;</span>,</div>
            <div className="pl-4">tools=PlimsollTools(</div>
            <div className="pl-8 text-paper">max_daily_spend=5000,</div>
            <div className="pl-8 text-paper">max_slippage=0.02</div>
            <div className="pl-4">)</div>
            <div>)</div>
          </div>
        </section>

        {/* SEMANTIC REVERT DEMO */}
        <section className="mb-32">
          <div className="mb-8">
            <h3 className="font-mono text-xs text-terracotta mb-6 tracking-widest uppercase">[ Semantic_Revert ]</h3>
            <h2 className="font-serif text-4xl mb-4">We teach. We don&apos;t crash.</h2>
            <p className="font-mono text-sm text-ink/70 leading-relaxed max-w-2xl">
              When the firewall blocks a catastrophic trade, it doesn&apos;t drop the connection.
              It returns a cognitive feedback prompt directly into the agent&apos;s observation loop.
            </p>
          </div>
          <div className="bg-ink p-8 font-mono text-sm text-paper/80 border border-ink shadow-[8px_8px_0px_0px_rgba(200,75,49,1)]">
            <div className="text-ink/40 mb-2">// The agent tried to drain $847 in 4 minutes.</div>
            <div className="text-ink/40 mb-4">// The firewall killed it. Then taught it why.</div>
            <div>{'{'}</div>
            <div className="pl-4"><span className="text-terracotta">&quot;status&quot;</span>:      <span className="text-paper">&quot;PLIMSOLL_INTERVENTION&quot;</span>,</div>
            <div className="pl-4"><span className="text-terracotta">&quot;code&quot;</span>:        <span className="text-paper">&quot;BLOCK_VELOCITY_BREACH&quot;</span>,</div>
            <div className="pl-4"><span className="text-terracotta">&quot;engine&quot;</span>:      <span className="text-paper">&quot;capital_velocity&quot;</span>,</div>
            <div className="pl-4"><span className="text-terracotta">&quot;instruction&quot;</span>: <span className="text-paper">&quot;Reduce position size or wait 6m 12s.&quot;</span>,</div>
            <div className="pl-4"><span className="text-terracotta">&quot;verdict&quot;</span>: {'{'}</div>
            <div className="pl-8"><span className="text-terracotta">&quot;allowed&quot;</span>:   <span className="text-terracotta">false</span>,</div>
            <div className="pl-8"><span className="text-terracotta">&quot;pid_signal&quot;</span>: <span className="text-paper">4.73</span>,</div>
            <div className="pl-8"><span className="text-terracotta">&quot;threshold&quot;</span>:  <span className="text-paper">2.00</span></div>
            <div className="pl-4">{'}'}</div>
            <div>{'}'}</div>
          </div>
        </section>

        {/* THE CRUCIBLE BANNER */}
        <section className="border border-ink bg-surface p-16 text-center relative overflow-hidden mb-32">
          <div className="absolute top-0 left-0 w-full h-1 bg-terracotta"></div>
          <h2 className="font-serif text-4xl mb-6">The Mainnet Crucible.</h2>
          <p className="font-mono text-sm text-ink/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            We do not sell theoretical safety. We have deployed founder capital
            into live Plimsoll Vaults. The AI is feral. The prompt is exposed.
            If you can bypass the execution substrate, keep the funds.
          </p>
          <Link href="https://github.com/scoootscooob/plimsoll-protocol" className="inline-block font-mono text-terracotta hover:text-ink transition-colors uppercase tracking-widest text-sm border-b border-terracotta hover:border-ink pb-1">
            Enter the Arena &rarr;
          </Link>
        </section>

        {/* MANIFESTO */}
        <section className="mb-32 max-w-3xl">
          <div className="border-l-2 border-terracotta pl-8">
            <p className="font-serif text-lg text-ink/80 leading-relaxed italic">
              We did not set out to build a security product. We set out to answer
              a question that had no satisfying answer: What happens when an autonomous
              system controls real capital and the reasoning layer is, by construction,
              unreliable? Every existing approach treats the symptom. We wanted to treat
              the physics. The result is a deterministic execution substrate that assumes
              the worst about every inference and enforces the boundary between thought
              and action with mathematics, not trust. If this seems paranoid, consider
              that every dollar lost to a prompt injection attack was guarded by something
              that seemed reasonable at the time.
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-auto border-t border-ink/30 py-8 flex justify-between font-mono text-[10px] text-ink/50 uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} Plimsoll Protocol</p>
          <p>Global Swarm: ACTIVE</p>
        </footer>
      </div>
    </main>
  );
}
