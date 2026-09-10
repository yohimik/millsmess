package contracts

import (
	"encoding/json"
	"os"
	"testing"
)

func TestCounterAndOptionalFieldsRoundTrip(t *testing.T) {
	raw, err := os.ReadFile("../../contracts/examples/GameInput.json")
	if err != nil {
		t.Fatal(err)
	}
	var input GameInput
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatal(err)
	}
	input.Data.OwnerEpoch = "9007199254740993"
	encoded, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	var restored GameInput
	if err := json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.Data.OwnerEpoch != input.Data.OwnerEpoch {
		t.Fatal("epoch precision lost")
	}
	optional := NegotiateTransportData{}
	encoded, err = json.Marshal(optional)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["sdpOffer"]; ok {
		t.Fatal("absent optional field was serialized")
	}
	empty := ""
	optional.SdpOffer = &empty
	encoded, err = json.Marshal(optional)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	if string(fields["sdpOffer"]) != `""` {
		t.Fatal("explicit zero value was lost")
	}
}
