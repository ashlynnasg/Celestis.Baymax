import { useLocalSearchParams } from "expo-router";

import { CrewEditor } from "@/components/crew-editor";
import { ScreenContainer } from "@/components/screen-container";

export default function EditCrewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenContainer>
      <CrewEditor crewId={id} />
    </ScreenContainer>
  );
}
