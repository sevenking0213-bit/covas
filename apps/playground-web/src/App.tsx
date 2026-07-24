import { useMemo, useState } from 'react';
import { createWebWorkspaceSession } from '@covas/adapter-web';
import type { SubmitPayload } from '@covas/shared-types';
import { sampleImages } from './sampleImages';

const demoSession = {
  sessionId: 'demo-thread-local',
  pageId: 'page-main',
  prompt: 'Circle what should change, then describe the next Codex-style revision in one message.',
};

export function App() {
  const [lastSubmission, setLastSubmission] = useState<SubmitPayload | null>(null);
  const sessionTree = useMemo(
    () =>
      createWebWorkspaceSession({
        input: {
          images: sampleImages,
          activeImageId: 'sample-variation',
          context: {
            sessionId: demoSession.sessionId,
            pageId: demoSession.pageId,
            prompt: demoSession.prompt,
          },
        },
        onSubmit: async (payload) => {
          setLastSubmission(payload);
          console.info('Canvagent submit payload', payload);
        },
      }),
    [],
  );

  return (
    <main className="playground-shell">
      <div className="playground-layout">
        <aside className="playground-sidebar">
          <div className="playground-panel">
            <p className="playground-eyebrow">Local Demo Host</p>
            <h1>Local Demo Host</h1>
            <p className="playground-copy">
              Load the sample Codex-style session, annotate the sample images,
              submit a revision request, and inspect the exact payload that would go back to a host.
            </p>
            <p className="playground-copy">
              This page is the GitHub-user demo host. Start here, annotate the sample images,
              submit a revision request, and inspect the exact payload that would go back to a host.
            </p>
          </div>

          <div className="playground-panel">
            <h2>Session</h2>
            <dl className="playground-meta">
              <div>
                <dt>Session ID</dt>
                <dd>{demoSession.sessionId}</dd>
              </div>
              <div>
                <dt>Page ID</dt>
                <dd>{demoSession.pageId}</dd>
              </div>
            </dl>
          </div>

          <div className="playground-panel">
            <h2>History</h2>
            <ul className="playground-history">
              {sampleImages.map((image) => (
                <li key={image.id}>{image.id}</li>
              ))}
            </ul>
          </div>

          <div className="playground-panel playground-results">
            <h2>Last Submission</h2>
            {lastSubmission ? (
              <div className="playground-result-body">
                <p className="playground-result-draft">{lastSubmission.messageDraft}</p>
                <dl className="playground-meta">
                  <div>
                    <dt>Active image</dt>
                    <dd>{lastSubmission.activeImageId ?? lastSubmission.structuredResult.imageId}</dd>
                  </div>
                  <div>
                    <dt>Attachments</dt>
                    <dd>{lastSubmission.attachments.map((attachment) => attachment.name).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Annotations</dt>
                    <dd>{lastSubmission.structuredResult.annotations.map((annotation) => annotation.type).join(', ')}</dd>
                  </div>
                </dl>
                <pre>{JSON.stringify(lastSubmission, null, 2)}</pre>
              </div>
            ) : (
              <p className="playground-empty">Submit once to inspect the exact payload and attachment summary here.</p>
            )}
          </div>
        </aside>

        <section className="playground-workspace">{sessionTree}</section>
      </div>
    </main>
  );
}
