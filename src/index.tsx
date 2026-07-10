import {findByProps} from "@vendetta/metro";
import {FluxDispatcher} from "@vendetta/metro/common";
import {after, before} from "@vendetta/patcher";
import {React, ReactNative as RN} from "@vendetta/metro/common";
import {getAssetIDByName as getAssetId} from "@vendetta/ui/assets"
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
                paddingVertical: 14,
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
        const message = msg?.message ?? msg?.item?.message ?? msg?.message?.message;
        if (!message?.id || !message?.channel_id) return;

        component.then(instance => {
            const unpatch = after("default", instance, () => {
                React.useEffect(() => () => {
                    unpatch()
                }, [])

                // Replace the ENTIRE sheet contents with just our row
                return (
                    <RN.View style={{paddingVertical: 8, paddingBottom: 24}}>
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
                        />
                    </RN.View>
                )
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
