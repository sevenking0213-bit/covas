import { createRoot } from 'react-dom/client';
import { createWebWorkspaceSession } from '@covas/adapter-web';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root container for the web-basic example.');
}

const root = createRoot(container);

root.render(
  createWebWorkspaceSession({
    input: {
      images: [
        {
          id: 'demo-image',
          src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
          title: 'Demo image',
          kind: 'reference',
        },
      ],
      context: {
        prompt: 'Mark the area to revise and describe the change you want.',
      },
    },
    onSubmit: async (payload) => {
      console.log('Canvagent example payload', payload);
    },
  }),
);
