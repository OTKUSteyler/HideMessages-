// src/components/Settings.tsx
import {storage} from "@vendetta/plugin";
import {useProxy} from "@vendetta/storage";
import {React, ReactNative as RN} from "@vendetta/metro/common";
import {General} from "@vendetta/ui/components";

const {ScrollView} = General;

const DEFAULT_INDEX = 2;

export default function Settings() {
    useProxy(storage);

    const currentIndex = storage.hideMessagesIndex ?? DEFAULT_INDEX;
    const [text, setText] = React.useState(String(currentIndex));

    const commit = (value: string) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= 0) {
            storage.hideMessagesIndex = parsed;
        } else {
            // revert to last valid value if input was garbage
            setText(String(storage.hideMessagesIndex ?? DEFAULT_INDEX));
        }
    };

    return (
        <ScrollView style={{flex: 1, paddingHorizontal: 16, paddingTop: 16}}>
            <RN.Text
                style={{
                    fontSize: 14,
                    color: "white",
                    marginBottom: 8,
                    fontWeight: "600"
                }}
            >
                Button Position
            </RN.Text>
            <RN.Text
                style={{
                    fontSize: 12,
                    color: "grey",
                    marginBottom: 12
                }}
            >
                Index in the message action sheet's button row where "Hide Message" will be inserted. Default is {DEFAULT_INDEX}.
            </RN.Text>
            <RN.TextInput
                value={text}
                onChangeText={setText}
                onBlur={() => commit(text)}
                onSubmitEditing={() => commit(text)}
                keyboardType="number-pad"
                placeholder={String(DEFAULT_INDEX)}
                placeholderTextColor="grey"
                style={{
                    color: "white",
                    backgroundColor: "#2b2d31",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 14
                }}
            />
            <RN.TouchableOpacity
                onPress={() => {
                    storage.hideMessagesIndex = DEFAULT_INDEX;
                    setText(String(DEFAULT_INDEX));
                }}
                style={{
                    marginTop: 16,
                    alignSelf: "flex-start",
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: "#4e5058",
                    borderRadius: 8
                }}
            >
                <RN.Text style={{color: "white", fontSize: 13}}>
                    Reset to Default
                </RN.Text>
            </RN.TouchableOpacity>
        </ScrollView>
    );
}
