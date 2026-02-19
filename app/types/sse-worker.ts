import type { SsePacket } from './sse';
import type { ProjectState, WorkerNotificationEntry } from './worker-state';

export type TabToWorkerMessage =
  | {
      type: 'connect';
      baseUrl: string;
      authorization?: string;
    }
  | {
      type: 'disconnect';
    }
  | {
      type: 'selection.active';
      key: string;
    };

export type WorkerToTabMessage =
  | {
      type: 'packet';
      packet: SsePacket;
    }
  | {
      type: 'connection.open';
    }
  | {
      type: 'connection.error';
      message: string;
      statusCode?: number;
    }
  | {
      type: 'connection.reconnected';
    }
  | {
      type: 'state.bootstrap';
      projects: Record<string, ProjectState>;
      notifications: Record<string, WorkerNotificationEntry>;
    }
  | {
      type: 'state.project-updated';
      projectId: string;
      project: ProjectState;
    }
  | {
      type: 'state.project-removed';
      projectId: string;
    }
  | {
      type: 'state.notifications-updated';
      notifications: Record<string, WorkerNotificationEntry>;
    }
  | {
      type: 'notification.show';
      key: string;
      kind: 'permission' | 'question' | 'idle';
    };
