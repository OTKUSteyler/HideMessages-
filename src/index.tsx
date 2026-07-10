import { findByProps } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { after, before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";

const DEBUG = false; 

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

let patches = [];
let currentMessage = null;
const patchedInstances = new WeakSet();

function ensureStorage() {
    if (!Array.isArray(storage.hiddenMessageIds)) {
        storage.hiddenMessageIds = [];
    }
}

function isHidden(id) {
    return storage.hiddenMessageIds?.includes(id);
}

function hideMessageLocally(message) {
    if (!message?.id) return;
    ensureStorage();
    if (!isHidden(message.id)) {
        storage.hiddenMessageIds.push(message.id);
    }
    LazyActionSheet.hideActionSheet();
}

function makeIcon() {
    const forms = findByProps("FormRow", "FormIcon");
    if (!forms?.FormIcon) return null;
    return <forms.FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_close_16px")} />;
}

function makeRow(message) {
    const forms = findByProps("FormRow", "FormIcon");
    if (!forms?.FormRow) return null;
    return (
        <forms.FormRow
            label="Hide Message"
            leading={<forms.FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_close_16px")} />}
            onPress={() => hideMessageLocally(message)}
        />
    );
}

function onLoad() {
    ensureStorage();

    patches.push(
        before("openLazy", LazyActionSheet, ([component, key, msg]) => {
            if (typeof key === "string" && !/message|media/i.test(key)) return;

            const message = msg?.message ?? msg?.item?.message ?? msg?.message?.message;
            if (!message?.id || !message?.channel_id) return;

            currentMessage = message;

            component.then((instance) => {
                if (patchedInstances.has(instance)) return;
                patchedInstances.add(instance);

                const unpatch = after("default", instance, (_, component) => {
                    try {
                        const buttons = findInReactTree(
                            component,
                            (x) => x?.[0]?.type?.name === "ButtonRow"
                        );

                        if (buttons) {
                            const alreadyThere = buttons.some(
                                (b) => b?.props?.label === "Hide Message"
                            );
                            if (!alreadyThere) {
                                buttons.splice(2, 0, makeRow(currentMessage));
                            }
                            return;
                        }

                        // No ButtonRow on this sheet — expected for sheets
                        // that slipped past the fast-path filter but still
                        // aren't the message context menu.
                        if (DEBUG) {
                            logger.log("HideMessages: could not find ButtonRow, key was", key);
                        }
                    } catch (e) {
                        logger.log("HideMessages: CRASH INSIDE PATCH:", e?.message, e?.stack);
                    }
                });

                patches.push(unpatch);
            });
        })
    );

    const MessageStore = findByProps("getMessages", "getMessage");
    if (MessageStore?.getMessages) {
        patches.push(
            after("getMessages", MessageStore, (_, ret) => {
                if (!ret?._array || !storage.hiddenMessageIds?.length) return ret;
                try {
                    ret._array = ret._array.filter((m) => !isHidden(m?.id));
                } catch (e) {
                    logger.log("HideMessages: filter error", e?.message);
                }
                return ret;
            })
        );
    } else if (DEBUG) {
        logger.log("HideMessages: MessageStore.getMessages not found");
    }
}

export default {
    onLoad,
    onUnload: () => {
        for (const unpatch of patches) unpatch();
        patches = [];
    },
};
