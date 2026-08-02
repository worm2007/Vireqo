"use client";

export const VIREQO_CHAT_EVENT = "vireqo:chat";

export type VireqoChatEventDetail = {
  message?: string;
  submit?: boolean;
};

export function openVireqoChat(message?: string, submit = false) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<VireqoChatEventDetail>(VIREQO_CHAT_EVENT, {
      detail: { message, submit },
    }),
  );
}
