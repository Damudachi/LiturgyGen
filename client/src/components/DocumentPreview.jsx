import { formatHeader } from '../lib/dates';
import { cx } from './ui';

/**
 * An on-screen facsimile of the generated .docx. It deliberately mirrors
 * docxService: same order, same emphasis, same wording, so what the office sees
 * here is what comes out of Word.
 */

function SectionHeading({ label, citation }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-4 font-bold">
      <span>{label}</span>
      {citation && <span className="shrink-0">{citation}</span>}
    </div>
  );
}

function ReadingBlock({ part, label, closing, response }) {
  if (!part) return null;
  return (
    <>
      <SectionHeading label={label} citation={part.citation} />
      {part.intro && <p className="font-bold">{part.intro}</p>}
      <div>
        {part.lines.map((line, index) =>
          line ? <p key={index}>{line}</p> : <p key={index}>&nbsp;</p>,
        )}
      </div>
      {closing && (
        <>
          <p>&nbsp;</p>
          <p className="font-bold italic">{closing}</p>
          <p className="italic">{response}</p>
        </>
      )}
    </>
  );
}

function PsalmBlock({ psalm, repeatRefrain = true, firstUppercase = true }) {
  if (!psalm) return null;
  const refrain = psalm.refrain;

  return (
    <>
      <SectionHeading label="RESPONSORIAL PSALM" citation={psalm.citation} />
      <div className="mt-1">
        {refrain ? (
          <p>
            R. <span className="font-bold">{firstUppercase ? refrain.toUpperCase() : refrain}</span>
          </p>
        ) : (
          <p className="rounded bg-amber-100 px-1 text-amber-900">
            R. [no response found — add one before printing]
          </p>
        )}

        {psalm.stanzas.map((stanza, index) => (
          <div key={index}>
            {stanza.map((line, lineIndex) => (
              <p key={lineIndex}>{line}</p>
            ))}
            {refrain && (repeatRefrain || index === psalm.stanzas.length - 1) && (
              <p>
                R. <span className="font-bold">{refrain}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function AcclamationBlock({ acclamation }) {
  if (!acclamation) return null;
  const refrain = acclamation.refrain || 'Alleluia, alleluia.';
  return (
    <div className="mt-4">
      <p className="font-bold">R. {refrain}</p>
      {acclamation.verse.length ? (
        acclamation.verse.map((line, index) => (
          <p key={index}>
            {index === 0 && <span className="font-bold italic">Commentator</span>}
            {index === 0 && <span> : </span>}
            {line}
          </p>
        ))
      ) : (
        <p className="rounded bg-amber-100 px-1 text-amber-900">
          Commentator : [no acclamation verse found — add one before printing]
        </p>
      )}
      <p>
        <span className="font-bold">R. </span>
        {refrain}
      </p>
    </div>
  );
}

function PotfBlock({ potf, occasionTitle, appendSuffix = true }) {
  if (!potf) {
    return (
      <div className="mt-6 rounded bg-amber-100 px-2 py-1.5 text-sm text-amber-900">
        No Prayers of the Faithful template matched this day. Add one in the Template Manager.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-center font-bold">{occasionTitle}</p>

      {potf.priestInvitation && (
        <p className="mt-2 text-justify font-bold">
          <span className="font-bold">Priest:</span> {potf.priestInvitation}
        </p>
      )}

      {potf.responseOptions.map((response, index) => (
        <div key={index}>
          {index > 0 && <p className="my-2 text-center font-bold">OR</p>}
          <p className="text-center font-bold">{response.toUpperCase()}</p>
        </div>
      ))}

      <div className="mt-3 space-y-3">
        {potf.intentions.map((intention, index) => {
          const body = intention.trim();
          const punctuated = appendSuffix && !/[.?!]$/.test(body) ? `${body}.` : body;
          return (
            <p key={index} className="text-justify">
              {index + 1}. {punctuated}{' '}
              {appendSuffix && <span className="font-bold italic">Let us pray to the Lord.</span>}
            </p>
          );
        })}
      </div>

      {potf.priestConclusion && (
        <p className="mt-3 text-justify font-bold">
          <span className="font-bold italic">Priest:</span>{' '}
          {/amen\.?$/i.test(potf.priestConclusion.trim())
            ? potf.priestConclusion.trim()
            : `${potf.priestConclusion.trim()} Amen.`}
        </p>
      )}
    </div>
  );
}

export default function DocumentPreview({ day, settings = {}, className }) {
  if (!day) return null;
  const readings = day.readings || {};

  return (
    <article
      className={cx(
        'missalette doc-page mx-auto rounded-lg bg-white px-10 py-8 text-[15px] leading-snug shadow-sm ring-1 ring-stone-200',
        className,
      )}
    >
      <p className="text-center text-lg font-bold">{formatHeader(day.date)}</p>
      <p className="text-center text-lg font-bold">LITURGY OF THE WORD</p>

      <ReadingBlock
        part={readings.reading1}
        label="FIRST READING"
        closing="The Word of the Lord."
        response="All: Thanks be to God."
      />

      <PsalmBlock
        psalm={readings.psalm}
        repeatRefrain={settings.repeatPsalmRefrain !== false}
        firstUppercase={settings.firstRefrainUppercase !== false}
      />

      <ReadingBlock
        part={readings.reading2}
        label="SECOND READING"
        closing="The Word of the Lord."
        response="All: Thanks be to God."
      />

      {settings.includeSequence !== false && readings.sequence && (
        <ReadingBlock part={readings.sequence} label="SEQUENCE" />
      )}

      <AcclamationBlock acclamation={readings.acclamation} />

      {settings.includeGospel && readings.gospel && (
        <ReadingBlock
          part={readings.gospel}
          label="GOSPEL"
          closing="The Gospel of the Lord."
          response="All: Praise to you, Lord Jesus Christ."
        />
      )}

      <PotfBlock
        potf={day.potf}
        occasionTitle={day.occasionTitle}
        appendSuffix={settings.appendIntentionSuffix !== false}
      />
    </article>
  );
}
