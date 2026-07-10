import { findByProps } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { after, before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { logger } from "@vendetta";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

let patches = [];

function onLoad() {
    patches.push(
        before("openLazy", LazyActionSheet, ([component, key, msg]) => {
            const message = msg?.message ?? msg?.item?.message ?? msg?.message?.message;
            if (!message?.id || !message?.channel_id) return;

            component.then((instance) => {
                const unpatch = after("default", instance, (_, component) => {
                    React.useEffect(() => () => {
                        unpatch();
                    }, []);

                    try {
                        const buttons = findInReactTree(
                            component,
                            (x) => x?.[0]?.type?.name === "ButtonRow"
                        );

                        if (buttons) {
                            buttons.length = 0;
                            buttons.push(makeRow(message));
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

                            if (ActionSheetRow) {
                                upperGroup.props.children = [
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
                                        onPress={() => hideMessage(message)}
                                        key="hide-message"
                                    />
                                ];
                                for (let i = 1; i < actionSheetContainer.length; i++) {
                                    actionSheetContainer[i] = null;
                                }
                                return;
                            }
                        }

                        logger.log("HideMessages: could not find ButtonRow or ActionSheetRowGroup");
                    } catch (e) {
                        logger.log("HideMessages: CRASH INSIDE PATCH:", e?.message, e?.stack);
                    }
                });
            });
        })
    );
}

function hideMessage(message) {
    const FluxDispatcher = findByProps("dispatch", "subscribe");
    if (!FluxDispatcher?.dispatch) {
        logger.log("HideMessages: FluxDispatcher.dispatch not found");
        return;
    }
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
    if (!forms?.FormIcon) {
        logger.log("HideMessages: FormIcon not found");
        return null;
    }
    return <forms.FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_close_16px")} />;
}

function makeRow(message) {
    const forms = findByProps("FormRow", "FormIcon");
    if (!forms?.FormRow) {
        logger.log("HideMessages: FormRow not found");
        return null;
    }
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
    },
};
