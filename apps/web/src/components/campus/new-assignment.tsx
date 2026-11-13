"use client";

import { useRouter } from "next/navigation";

import { createAssignment, publishAssignment } from "@/lib/api";

import { AssignmentFormView } from "./assignment-form";
import { toInput } from "./assignment-model";
import { campusHref, useCampusOrg } from "./campus-context";

export function NewAssignment() {
  const { orgId, accessToken } = useCampusOrg();
  const router = useRouter();
  return (
    <AssignmentFormView
      onSave={async (form) => {
        const created = await createAssignment(accessToken, orgId, toInput(form));
        router.push(campusHref(`/campus/assignments/${created.id}`, orgId));
      }}
      onSaveAndPublish={async (form) => {
        const created = await createAssignment(accessToken, orgId, toInput(form));
        const published = await publishAssignment(accessToken, orgId, created.id);
        router.push(campusHref(`/campus/assignments/${published.id}`, orgId));
      }}
    />
  );
}
