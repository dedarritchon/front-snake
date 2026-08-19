import type {ApplicationChannel, ApplicationRecipient} from '@frontapp/plugin-sdk';
import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ConversationWithChannels {
  channels?: readonly Pick<ApplicationChannel, 'name' | 'address'>[];
}

export function getRecipientEmails(recipient: ApplicationRecipient | null): string[] {
  if (!recipient) {
    return [];
  }

  const emails: string[] = [];
  const dedupe = new Set<string>();

  const maybeAddEmail = (type: string, handle: string) => {
    const normalizedHandle = handle.trim().toLowerCase();

    if (normalizedHandle === '') {
      return;
    }

    if (type !== 'email' && !EMAIL_REGEX.test(normalizedHandle)) {
      return;
    }

    if (dedupe.has(normalizedHandle)) {
      return;
    }

    dedupe.add(normalizedHandle);
    emails.push(normalizedHandle);
  };

  maybeAddEmail(recipient.type, recipient.handle);
  (recipient.contact?.handles ?? []).forEach((handle) => {
    maybeAddEmail(handle.type, handle.handle);
  });

  return emails;
}

export function getRecipientInitials(recipient: ApplicationRecipient): string {
  const candidate = recipient.name?.trim() ?? recipient.handle;
  const firstLetter = candidate.slice(0, 1).toUpperCase();
  return firstLetter === '' ? '?' : firstLetter;
}

export function getRecipientsDefaultSelection(
  recipients: readonly ApplicationRecipient[],
  context: WebViewContext,
): ApplicationRecipient | null {
  if (recipients.length === 0) {
    return null;
  }

  if (context.type === 'singleConversation') {
    const conversationRecipient = context.conversation.recipient;
    if (!conversationRecipient) {
      return recipients.find((recipient) => getRecipientEmails(recipient).length > 0) ?? recipients[0];
    }

    const defaultConversationRecipient = recipients.find((recipient) => {
      return recipient.handle === conversationRecipient.handle;
    });

    if (defaultConversationRecipient && getRecipientEmails(defaultConversationRecipient).length > 0) {
      return defaultConversationRecipient;
    }
  }

  const internalHandles = new Set<string>([context.teammate.email.toLowerCase()]);
  if (context.type === 'singleConversation') {
    const conversationWithChannels = context.conversation as ConversationWithChannels;
    (conversationWithChannels.channels ?? []).forEach((channel) => {
      if (channel.name) {
        internalHandles.add(channel.name.toLowerCase());
      }
      if (channel.address) {
        internalHandles.add(channel.address.toLowerCase());
      }
    });
  }

  const externalRecipient = recipients.find((recipient) => {
    return !internalHandles.has(recipient.handle.toLowerCase()) && getRecipientEmails(recipient).length > 0;
  });
  if (externalRecipient) {
    return externalRecipient;
  }

  return recipients.find((recipient) => getRecipientEmails(recipient).length > 0) ?? recipients[0];
}
