import {findByProps} from "@vendetta/metro";
import {FluxDispatcher} from "@vendetta/metro/common";
import {after, before} from "@vendetta/patcher";
import {React, ReactNative as RN} from "@vendetta/metro/common";
import {getAssetIDByName as getAssetId} from "@vendetta/ui/assets"
import {findInReactTree} from "@vendetta/utils"
import Settings from "./components/Settings";
import {storage} from "@vendetta/plugin";
import {logger} from "@vendetta";
import {General} from "@vendetta/ui/components";

const {TableRow, TableRowIcon} = General;

let patches = [];
const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

function HideMessageRow({onPress}: {onPress: () => void}) {
    return (
        <TableRow
            label="Hide Message"
            icon={<TableRowIcon source={getAssetId("ic_close_16px")} />}
            onPress={onPress}
        />
    );
}

function onLoad() {
    logger.log("HideMessages: Index at ", storage.hideMessagesIndex);
    patches.push(before("openLazy", LazyActionSheet, ([component, key, msg]) => {
        const message = msg?.message;
        if (key != "MessageLongPressActionSheet" || !message) return;

        component.then(instance => {
            const unpatch = after("default", instance, (_, component) => {
                React.useEffect(() => () => {
                    unpatch()
                }, [])

                const buttons = findInReactTree(
                    component,
                    x => Array.isArray(x) && x.some(y => typeof y?.props?.label === "string" && typeof y?.props?.onPress === "function")
                )

                if (!buttons) {
                    logger.log("HideMessages: could not find rows array in action sheet tree")
                    return
                }

                buttons.splice(storage.hideMessagesIndex ?? 2, 0,
                    <HideMessageRow
                        onPress={() => {
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_DELETE",
                                channelId: message.channel_id,
                                id: message.id,
                                __vml_cleanup: true,
                                otherPluginBypass: true
                            })
                            LazyActionSheet.hideActionSheet()
                        }}
                    />)
            })
        })
    }));
}

export default {
    onLoad,
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
    },
    settings: Settings
}
