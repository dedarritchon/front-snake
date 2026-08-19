import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {EntryPointNotificationTypesEnum} from '@frontapp/ui-bridge/dist/internal/contextTypesV2';
import {HttpVerbsEnum} from '@frontapp/ui-bridge/dist/internal/httpTypesV2';
import type {
  ApplicationAttachmentId,
  ApplicationCommentId,
  ApplicationConversationId,
  ApplicationDraftId,
  ApplicationInboxId,
  ApplicationMessageId,
  ApplicationTagId,
  ApplicationTeammateId,
  ApplicationTopicId,
} from '@frontapp/ui-bridge/dist/internal/idTypesV2';
import {WidgetTypesEnum} from '@frontapp/ui-bridge/dist/internal/widgetTypesV2';

export interface ContextCommandDemo {
  /** Short hint shown under the button. */
  hint: string;
  run: (context: WebViewContext) => Promise<unknown>;
}

type ContextFn = (...args: never[]) => Promise<unknown>;

function asRecord(context: WebViewContext): Record<string, unknown> {
  return context as unknown as Record<string, unknown>;
}

function getFn(context: WebViewContext, name: string): ContextFn {
  const fn = asRecord(context)[name];
  if (typeof fn !== 'function') {
    throw new Error(`${name} is not available on this context.`);
  }
  return (fn as ContextFn).bind(context);
}

function getConversationId(context: WebViewContext): ApplicationConversationId | null {
  switch (context.type) {
    case 'singleConversation':
    case 'singleConversationPopover':
      return context.conversation.id;
    case 'multiConversations':
      return context.conversations[0]?.id ?? null;
    case 'messageComposer':
      return context.conversation?.id ?? null;
    default:
      return null;
  }
}

function getConversationLinks(context: WebViewContext): ReadonlyArray<{id: ApplicationTopicId}> {
  switch (context.type) {
    case 'singleConversation':
    case 'singleConversationPopover':
      return context.conversation.links ?? [];
    case 'multiConversations':
      return context.conversations[0]?.links ?? [];
    case 'messageComposer':
      return context.conversation?.links ?? [];
    default:
      return [];
  }
}

async function firstTeammateId(context: WebViewContext): Promise<ApplicationTeammateId> {
  const list = await context.listTeammates();
  const id = list.results[0]?.id;
  if (!id) throw new Error('No teammates available for demo.');
  return id;
}

async function firstInboxId(context: WebViewContext): Promise<ApplicationInboxId> {
  const list = await context.listInboxes();
  const id = list.results[0]?.id;
  if (!id) throw new Error('No inboxes available for demo.');
  return id;
}

async function firstTagId(context: WebViewContext): Promise<ApplicationTagId> {
  const list = await context.listTags();
  const id = list.results[0]?.id;
  if (!id) throw new Error('No tags available for demo.');
  return id;
}

async function firstMessageWithAttachment(context: WebViewContext): Promise<{
  messageId: ApplicationMessageId | ApplicationCommentId;
  attachmentId: ApplicationAttachmentId;
}> {
  const listMessages = getFn(context, 'listMessages');
  const list = (await listMessages()) as {
    results: ReadonlyArray<{
      id: ApplicationMessageId;
      content?: {attachments?: ReadonlyArray<{id: ApplicationAttachmentId}>};
    }>;
  };

  for (const message of list.results ?? []) {
    const attachmentId = message.content?.attachments?.[0]?.id;
    if (attachmentId) {
      return {messageId: message.id, attachmentId};
    }
  }

  throw new Error('No message attachments found for demo.');
}

/** Demo runners for SDK methods. Used when the method exists on this context. */
export const CONTEXT_COMMAND_DEMOS: Record<string, ContextCommandDemo> = {
  authenticate: {
    hint: 'authenticate()',
    run: (context) => context.authenticate(),
  },
  deauthenticate: {
    hint: 'deauthenticate()',
    run: (context) => context.deauthenticate(),
  },
  listTeammates: {
    hint: 'listTeammates()',
    run: (context) => context.listTeammates(),
  },
  listInboxes: {
    hint: 'listInboxes()',
    run: (context) => context.listInboxes(),
  },
  listChannels: {
    hint: 'listChannels()',
    run: (context) => context.listChannels(),
  },
  listTags: {
    hint: 'listTags()',
    run: (context) => context.listTags(),
  },
  listTicketStatuses: {
    hint: 'listTicketStatuses()',
    run: (context) => context.listTicketStatuses(),
  },
  listRecipients: {
    hint: 'listRecipients()',
    run: (context) => getFn(context, 'listRecipients')(),
  },
  listMessages: {
    hint: 'listMessages()',
    run: (context) => getFn(context, 'listMessages')(),
  },
  listComments: {
    hint: 'listComments()',
    run: (context) => getFn(context, 'listComments')(),
  },
  fetchPath: {
    hint: 'fetchPath()',
    run: (context) => getFn(context, 'fetchPath')(),
  },
  openUrl: {
    hint: 'openUrl("https://front.com")',
    run: (context) => context.openUrl('https://front.com'),
  },
  openUrlInPopup: {
    hint: 'openUrlInPopup("https://front.com", {width:640,height:480})',
    run: (context) => context.openUrlInPopup('https://front.com', {width: 640, height: 480}),
  },
  openConversationInPopup: {
    hint: 'openConversationInPopup(currentConversationId)',
    run: async (context) => {
      const conversationId = getConversationId(context);
      if (!conversationId) throw new Error('No conversation selected.');
      return context.openConversationInPopup(conversationId);
    },
  },
  search: {
    hint: 'search("front")',
    run: (context) => context.search('front'),
  },
  displayNotification: {
    hint: 'displayNotification(SUCCESS_MESSAGE)',
    run: (context) =>
      getFn(context, 'displayNotification')({
        type: EntryPointNotificationTypesEnum.SUCCESS_MESSAGE,
        title: 'Plugin template',
        message: 'Hello from the context command demo.',
      } as never),
  },
  dismissNotification: {
    hint: 'displayNotification → dismissNotification(id)',
    run: async (context) => {
      const display = getFn(context, 'displayNotification');
      const dismiss = getFn(context, 'dismissNotification');
      const notificationId = (await display({
        type: EntryPointNotificationTypesEnum.SUCCESS_MESSAGE,
        title: 'Plugin template',
        message: 'This notification will be dismissed.',
      } as never)) as string;
      await dismiss(notificationId as never);
      return {notificationId, dismissed: true};
    },
  },
  createDraft: {
    hint: 'createDraft({subject, content})',
    run: (context) =>
      context.createDraft({
        subject: 'Plugin template demo',
        content: {body: 'Draft from plugin template demo.', type: 'text'},
      }),
  },
  updateDraft: {
    hint: 'createDraft → updateDraft(id, {updateMode:"replace", content})',
    run: async (context) => {
      let draftId: ApplicationDraftId | undefined =
        context.type === 'messageComposer' ? context.draft.id : undefined;

      if (!draftId) {
        const draft = await context.createDraft({
          subject: 'Plugin template update demo',
          content: {body: 'Before update.', type: 'text'},
        });
        draftId = draft.id;
      }

      await context.updateDraft(draftId, {
        updateMode: 'replace',
        content: {body: 'Updated by plugin template demo.', type: 'text'},
      });
      return {draftId, updated: true};
    },
  },
  fetchDraft: {
    hint: 'createDraft → fetchDraft(id)',
    run: async (context) => {
      const fetchDraft = getFn(context, 'fetchDraft');
      if (context.type === 'messageComposer') {
        return fetchDraft(context.draft.id as never);
      }
      const draft = await context.createDraft({
        subject: 'Plugin template fetch demo',
        content: {body: 'Fetch me.', type: 'text'},
      });
      return fetchDraft(draft.id as never);
    },
  },
  createWidget: {
    hint: 'createWidget({id, type: BLOCK})',
    run: (context) =>
      context.createWidget({
        id: `plugin-template-widget-${Date.now()}`,
        type: WidgetTypesEnum.BLOCK,
      }),
  },
  destroyWidget: {
    hint: 'createWidget → destroyWidget(id)',
    run: async (context) => {
      const widget = await context.createWidget({
        id: `plugin-template-widget-${Date.now()}`,
        type: WidgetTypesEnum.BLOCK,
      });
      await context.destroyWidget(widget.id);
      return {widgetId: widget.id, destroyed: true};
    },
  },
  sendHttp: {
    hint: 'sendHttp({verb: GET, path: "/"})',
    run: (context) =>
      context.sendHttp({
        verb: HttpVerbsEnum.GET,
        path: '/',
      }),
  },
  relayHttp: {
    hint: 'relayHttp({verb: GET, url: "https://httpbin.org/get"})',
    run: (context) =>
      context.relayHttp({
        verb: HttpVerbsEnum.GET,
        url: 'https://httpbin.org/get',
        headers: {Accept: 'application/json'},
      }),
  },
  addLink: {
    hint: 'addLink("https://front.com", "Front")',
    run: (context) => getFn(context, 'addLink')('https://front.com' as never, 'Front' as never),
  },
  addTopic: {
    hint: 'addTopic("https://front.com", "Front") (deprecated)',
    run: (context) => getFn(context, 'addTopic')('https://front.com' as never, 'Front' as never),
  },
  removeLink: {
    hint: 'removeLink(firstConversationLinkId)',
    run: async (context) => {
      const link = getConversationLinks(context)[0];
      if (!link) throw new Error('No conversation links to remove. Run addLink first.');
      await getFn(context, 'removeLink')(link.id as never);
      return {linkId: link.id, removed: true};
    },
  },
  assign: {
    hint: 'assign(firstTeammateId)',
    run: async (context) => {
      const teammateId = await firstTeammateId(context);
      await getFn(context, 'assign')(teammateId as never);
      return {teammateId, assigned: true};
    },
  },
  move: {
    hint: 'move(firstInboxId)',
    run: async (context) => {
      const inboxId = await firstInboxId(context);
      await getFn(context, 'move')(inboxId as never);
      return {inboxId, moved: true};
    },
  },
  setStatus: {
    hint: 'setStatus("open")',
    run: async (context) => {
      await getFn(context, 'setStatus')('open' as never);
      return {status: 'open'};
    },
  },
  tag: {
    hint: 'tag([firstTagId])',
    run: async (context) => {
      const tagId = await firstTagId(context);
      await getFn(context, 'tag')([tagId] as never);
      return {tagIds: [tagId], tagged: true};
    },
  },
  untag: {
    hint: 'untag([firstTagId])',
    run: async (context) => {
      const tagId = await firstTagId(context);
      await getFn(context, 'untag')([tagId] as never);
      return {tagIds: [tagId], untagged: true};
    },
  },
  downloadAttachment: {
    hint: 'listMessages → downloadAttachment(messageId, attachmentId)',
    run: async (context) => {
      const {messageId, attachmentId} = await firstMessageWithAttachment(context);
      const file = await getFn(context, 'downloadAttachment')(messageId as never, attachmentId as never);
      if (!file) return {messageId, attachmentId, file: null};
      const downloaded = file as File;
      return {
        messageId,
        attachmentId,
        file: {name: downloaded.name, size: downloaded.size, type: downloaded.type},
      };
    },
  },
  downloadComposerAttachment: {
    hint: 'downloadComposerAttachment(firstDraftAttachmentId)',
    run: async (context) => {
      if (context.type !== 'messageComposer') {
        throw new Error('downloadComposerAttachment requires messageComposer context.');
      }
      const attachmentId = context.draft.content.attachments[0]?.id;
      if (!attachmentId) throw new Error('Draft has no attachments.');
      const file = await getFn(context, 'downloadComposerAttachment')(attachmentId as never);
      if (!file) return {attachmentId, file: null};
      const downloaded = file as File;
      return {
        attachmentId,
        file: {name: downloaded.name, size: downloaded.size, type: downloaded.type},
      };
    },
  },
  requestClose: {
    hint: 'requestClose()',
    run: (context) => getFn(context, 'requestClose')(),
  },
  close: {
    hint: 'close()',
    run: (context) => getFn(context, 'close')(),
  },
  closeDraft: {
    hint: 'closeDraft()',
    run: (context) => getFn(context, 'closeDraft')(),
  },
};

export function listAvailableContextCommands(context: WebViewContext): Array<{
  name: string;
  arity: number;
  hasDemo: boolean;
  hint: string;
}> {
  const arities = context.functionArities ?? {};
  return Object.keys(arities)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const demo = CONTEXT_COMMAND_DEMOS[name];
      const arity = arities[name] ?? 0;
      return {
        name,
        arity,
        hasDemo: Boolean(demo) || arity === 0,
        hint: demo?.hint ?? (arity === 0 ? 'Call with no arguments' : 'No safe demo args configured'),
      };
    });
}

export async function runContextCommand(context: WebViewContext, name: string): Promise<unknown> {
  const demo = CONTEXT_COMMAND_DEMOS[name];
  if (demo) {
    return demo.run(context);
  }

  const arity = context.functionArities?.[name];
  const fn = asRecord(context)[name];
  if (typeof fn !== 'function') {
    throw new Error(`${name} is not a function on this context.`);
  }

  if (arity === 0) {
    return (fn as () => Promise<unknown>).call(context);
  }

  throw new Error(`No demo configured for ${name} (arity ${arity}).`);
}
