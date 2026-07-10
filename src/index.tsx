import { findByProps } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { after, before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { logger } from "@vendetta";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

let patches = [];
let currentMessage = null;
const patchedInstances = new WeakSet();

function onLoad() {
    patches.push(
        before("openLazy", LazyActionSheet, ([component, key, msg]) => {
            const message = msg?.message ?? msg?.item?.message ?? msg?.message?.message;
            if (!message?.id || !message?.channel_id) return;

            // Always keep this up to date — read at render time, not capture time
            currentMessage = message;

            component.then((instance) => {
                // Only ever patch "default" ONCE per module instance
                if (patchedInstances.has(instance)) return;
                patchedInstances.add(instance);

                const unpatch = after("default", instance, (_, component) => {
                    try {
                        const buttons = findInReactTree(
                            component,
                            (x) => x?.[0]?.type?.name === "ButtonRow"
                        );

                        if (buttons) {
                            // Dedupe guard: never insert if already present
                            const alreadyThere = buttons.some(
                                (b) => b?.props?.label === "Hide Message"
                            );
                            if (!alreadyThere) {
                                buttons.splice(2, 0, makeRow(currentMessage));
                            }
                            return;
                        }

                        const actionSheetContainer = findInReactTree(
                            component,
                            (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup"
                        );

                        if (actionSheetContainer && actionSheetContainer[0]) {
                            const upperGroup = actionSheetContainer[0];
                            const ActionSheetRow = upperGroup.props.children[0]?.type;
                            const templateIcon = upperGroup.props.children[0]?.props?.icon;

                            const alreadyThere = upperGroup.props.children.some(
                                (b) => b?.props?.label === "Hide Message"
                            );

                            if (ActionSheetRow && !alreadyThere) {
                                upperGroup.props.children.push(
                                    <ActionSheetRow
                                        label="Hide Message"
                                        icon={
                                            templateIcon
                                                ? {
                                                      $$typeof: templateIcon.$$typeof,
                                                      type: templateIcon.type,
                                                      key: null,
                                                      ref: null,
                                                      props: {
                                                          IconComponent: () => makeIcon(),
                                                      },
                                                  }
                                                : undefined
                                        }
                                        onPress={() => hideMessage(currentMessage)}
                                        key="hide-message"
                                    />
                                );
                            }
                            return;
                        }

                        logger.log("HideMessages: could not find ButtonRow or ActionSheetRowGroup");
                    } catch (e) {
                        logger.log("HideMessages: CRASH INSIDE PATCH:", e?.message, e?.stack);
                    }
                });

                patches.push(unpatch);
            });
        })
    );
}

function hideMessage(message) {
    if (!message) return;
    const FluxDispatcher = findByProps("dispatch", "subscribe");
    if (!FluxDispatcher?.dispatch) {
        logger.log("HideMessages: FluxDispatcher.dispatch not found");
        return;
    }
    // Dispatch directly — this bypasses Discord's real delete confirmation
    // prompt entirely, since we never call the native confirm-wrapped
    // delete action creator, just the client-side removal event.
    FluxDispatcher.dispatch({
        type: "MESSAGE_DELETE",
        channelId: message.channel_id,
        id: message.id,
        __vml_cleanup: true,
        otherPluginBypass: true,
    });
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
            onPress={() => hideMessage(message)}
        />
    );
}

export default {
    onLoad,
    onUnload: () => {
        for (const unpatch of patches) unpatch();
        patches = [];
    },
};
