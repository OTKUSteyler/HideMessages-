import {findByProps} from "@vendetta/metro";
import {FluxDispatcher} from "@vendetta/metro/common";
import {after, before} from "@vendetta/patcher";
import {React, ReactNative as RN} from "@vendetta/metro/common";
import {getAssetIDByName as getAssetId} from "@vendetta/ui/assets"
import {findInReactTree} from "@vendetta/utils"
import {logger} from "@vendetta";

let patches = [];
const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

function HideMessageRow({onPress}: {onPress: () => void}) {
    return (
        <RN.TouchableOpacity
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16
            }}
        >
            <RN.Image
                source={getAssetId("ic_close_16px")}
                style={{width: 20, height: 20, marginRight: 12, tintColor: "white"}}
            />
            <RN.Text style={{color: "white", fontSize: 16}}>
                Hide Message
            </RN.Text>
        </RN.TouchableOpacity>
    );
}

function onLoad() {
    logger.log("HideMessages: loaded");
    patches.push(before("openLazy", LazyActionSheet, ([component, key, msg]) => {
        // Grab the message no matter which action sheet fired (text, image, video, GIF, sticker, etc.)
        const message = msg?.message ?? msg?.item?.message ?? msg?.message?.message;
        if (!message?.id || !message?.channel_id) return;

        logger.log("HideMessages: matched sheet key =", key);

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
                    logger.log("HideMessages: could not find rows array for key", key);
                    return
                }

                buttons.splice(2, 0,
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
    }
}
