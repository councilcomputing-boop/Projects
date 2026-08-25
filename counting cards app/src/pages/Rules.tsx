import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { OrnateDivider } from '../components/GothicMotifs';

const values = [
{ range: '2 · 3 · 4 · 5 · 6', value: '+1', note: 'Low cards — count goes up' },
{ range: '7 · 8 · 9', value: '0', note: 'Neutral — no change' },
{ range: '10 · J · Q · K · A', value: '−1', note: 'High cards — count goes down' }];

const lessonRules = [
<>Every card dealt — yours, the dealer's, or any other soul at the table — feeds the <b>Running Count</b>.</>,
<>When it climbs positive, the deck grows heavy with high cards and aces. The house trembles. Wager boldly.</>,
<>When it falls negative, only the low cards remain, and fortune favors the house. Wager little, or not at all.</>,
<>But the Running Count alone is a crude instrument — meaningless without context. Divide it by the decks remaining, and you have the <b>True Count</b>, the number I actually act upon. Visit the Deck Math tab to master this division.</>,
<>In Manual mode, keyboard shortcuts work too: <b>↑</b> = +1, <b>↓</b> = -1, <b>→</b> = 0.</>];

const curriculum = [
<><b>Manual</b> — tap +1/0/-1 yourself while counting an actual physical deck.</>,
<><b>Classic/Peek Practice</b> — play simulated hands against a dealer with betting, splits, and my coaching; click the eye beside the dealer to check your count — for a price, 10 Blood Drops a look.</>,
<><b>Quiz Practice</b> — the same game, but the count stays hidden, and I will demand it of you at moments of my choosing. Answer correctly and I'll reward you for it.</>,
<><b>Deck Math</b> — a calculator and drill for converting running count to true count.</>,
<><b>Speed Drill</b> — a full deck flashes before you at speed; keep the count in your head and answer for it at the end.</>];

const trueCountExamples = [
{ running: '+4', decks: '2', tc: '+2.0' },
{ running: '+4', decks: '8', tc: '+0.5' },
{ running: '−6', decks: '1.5', tc: '−4.0' }];

export function Rules() {
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Rules" subtitle="A lesson from the Count" backTo="/" />

      <Panel label="A Lesson From The Count">
        <p className="font-serif text-sm italic leading-relaxed text-charcoal-soft">
          Sit. Listen well. In three centuries at the tables of Europe, I have never once lost the thread
          of a shoe. Tonight I teach you the method that keeps me... comfortable: the Hi-Lo count.
        </p>

        <ul className="mt-4">
          {values.map((row, i) =>
          <li key={row.range} className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-parch-line' : ''}`}>
              <span className="flex-1">
                <span className="block font-serif text-base font-semibold text-charcoal">{row.range}</span>
                <span className="mt-0.5 block text-xs text-charcoal-soft">{row.note}</span>
              </span>
              <span className="tabular font-serif text-2xl font-semibold text-gold-deep">{row.value}</span>
            </li>
          )}
        </ul>

        <OrnateDivider tone="light" className="my-4" />

        <ol className="flex flex-col gap-3">
          {lessonRules.map((rule, i) =>
          <li key={i} className="flex gap-3">
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maroon-800 font-serif text-xs font-semibold text-gold">
                {i + 1}
              </span>
              <span className="text-sm text-charcoal-soft">{rule}</span>
            </li>
          )}
        </ol>
      </Panel>

      <Panel label="The Curriculum">
        <p className="font-serif text-sm italic leading-relaxed text-charcoal-soft">
          I have prepared five chambers of instruction. Enter each in turn, or as you please — I am
          patient. I have centuries.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {curriculum.map((item, i) =>
          <li key={i} className="flex gap-3">
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maroon-800 font-serif text-xs font-semibold text-gold">
                {i + 1}
              </span>
              <span className="text-sm text-charcoal-soft">{item}</span>
            </li>
          )}
        </ol>
        <p className="mt-4 text-sm text-charcoal-soft">
          Below, the <b>Store</b> holds your Blood Drops — the coin you wager with — and the{' '}
          <b>Profile</b> tab holds your stats, your fortune, and every setting, gathered in one place.
        </p>
        <OrnateDivider tone="light" className="mt-5" />
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-deep/50 font-serif text-lg font-bold text-gold-deep">
            D
          </span>
          <p className="font-serif text-sm italic text-charcoal-soft">
            Until the shoe is empty,
            <br />— Count Dracula
          </p>
        </div>
      </Panel>

      <Panel label="Why True Count?">
        <p className="text-sm text-charcoal-soft">
          The <b>Running Count</b> alone doesn't tell you much once more than one deck is in play. A
          running count of +6 means the deck is loaded with high cards if there's only <b>1 deck</b> left
          — but it's barely a blip if there are <b>6 decks</b> left. To compare fairly (and know how much
          to bet), divide the running count by how many decks remain:
        </p>
        <p className="mt-4 text-center font-serif text-base font-semibold text-gold-deep">
          Running Count ÷ Decks Remaining = True Count
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-parch-line text-left text-xs uppercase tracking-wide text-charcoal-soft">
              <th className="py-2 font-serif font-semibold">Running</th>
              <th className="py-2 font-serif font-semibold">Decks Left</th>
              <th className="py-2 font-serif font-semibold">True Count</th>
            </tr>
          </thead>
          <tbody>
            {trueCountExamples.map((row, i) =>
            <tr key={i} className="border-b border-parch-line/60 last:border-0">
                <td className="tabular py-2 text-charcoal">{row.running}</td>
                <td className="tabular py-2 text-charcoal">{row.decks}</td>
                <td className="tabular py-2 font-semibold text-gold-deep">{row.tc}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-4 text-sm italic text-charcoal-soft">
          The true count — not the running count — is what tells you when the deck actually favors the
          player.
        </p>
      </Panel>
    </div>);

}
