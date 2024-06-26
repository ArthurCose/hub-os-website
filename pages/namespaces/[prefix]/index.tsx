import { useAppContext } from "@/components/context";
import PageActionMessage from "@/components/page-action-message";
import PageActions from "@/components/page-actions";
import { Account, AccountIdNameMap } from "@/types/account";
import { Namespace, Member, Role } from "@/types/namespace";
import { requestJSON, requestVoid } from "@/types/request";
import { NextPageContext } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import styles from "@/styles/Namespace.module.css";
import Head from "next/head";
import Link from "next/link";

type Props = { namespace?: Namespace; nameMap: AccountIdNameMap };

export default function NamespacePage({
  namespace,
  nameMap: nameMapProp,
}: Props) {
  const [invitingName, setInvitingName] = useState("");
  const [registered, setRegistered] = useState(namespace?.registered);
  const [members, setMembers] = useState(namespace?.members || []);
  const [nameMap, setNameMap] = useState(nameMapProp);
  const [errorMessage, setErrorMessage] = useState("");
  const context = useAppContext();
  const router = useRouter();

  useEffect(() => {
    // reset state if the namespace changed
    setInvitingName("");
    setRegistered(namespace?.registered);
    setMembers(namespace?.members || []);
    setNameMap(nameMapProp);
    setErrorMessage("");
  }, [namespace, nameMapProp]);

  if (!namespace) {
    return <>Namespace not found.</>;
  }

  const id = context.account?.id;
  const isNamespaceAdmin =
    namespace.members.find((member) => member.id == id)?.role == "admin" ||
    context.account?.admin;

  const inviteMember = async () => {
    if (!invitingName) {
      setErrorMessage("No username provided");
      return;
    }

    const accountResult = await requestJSON(
      "/api/users/by-name/" + encodeURIComponent(invitingName)
    );

    if (!accountResult.ok) {
      setErrorMessage("Failed to find user");
      return;
    }

    const account = accountResult.value as Account;

    if (members.some((member) => member.id == account.id)) {
      setErrorMessage("User already invited");
      return;
    }

    const encodedPrefix = encodeURIComponent(namespace.prefix);
    const result = await requestVoid(
      `/api/namespaces/${encodedPrefix}/invite?id=${account.id}`,
      { method: "POST" }
    );

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    const updatedMembers = [
      ...members,
      {
        id: account.id,
        role: "invited" as Role,
      },
    ];

    setMembers(updatedMembers);
    setInvitingName("");

    // update name map
    const ids = updatedMembers.map((member) => member.id as string);
    const nameMapResult = await requestJSON(`/api/users/name-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!nameMapResult.ok) {
      setErrorMessage(nameMapResult.error);
      return;
    }

    setNameMap(nameMapResult.value);
    setErrorMessage("");
  };

  const removeMember = async (member: Member, name: string, i: number) => {
    const updatedMembers = members.filter((_, j) => i != j);
    const hasAdmin = updatedMembers.some((member) => member.role == "admin");

    if (!hasAdmin) {
      setErrorMessage("Namespace must have at least one Admin");
      return;
    }

    if (!confirm(`Remove ${name}?`)) {
      return;
    }

    const encodedPrefix = encodeURIComponent(namespace.prefix);
    const result = await requestVoid(
      `/api/namespaces/${encodedPrefix}/members?id=${member.id}`,
      { method: "DELETE" }
    );

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setMembers(updatedMembers);
  };

  const updateRole = async (member: Member, role: Role, i: number) => {
    const updatedMembers = [...members];
    updatedMembers[i] = { ...member, role };

    const hasAdmin = updatedMembers.some((member) => member.role == "admin");

    if (!hasAdmin) {
      setErrorMessage("Namespace must have at least one Admin");
      return;
    }

    const encodedPrefix = encodeURIComponent(namespace.prefix);
    const result = await requestVoid(
      `/api/namespaces/${encodedPrefix}/members?id=${member.id}&role=${role}`,
      { method: "PATCH" }
    );

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setMembers(updatedMembers);
  };

  const deleteNamespace = async function (skipConfirmation: boolean) {
    if (!skipConfirmation && !confirm("Delete namespace?")) {
      return;
    }

    const encodedPrefix = encodeURIComponent(namespace.prefix);
    const result = await requestVoid(`/api/namespaces/${encodedPrefix}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    router.push(`/namespaces`);
  };

  const registerNamespace = async function () {
    const encodedPrefix = encodeURIComponent(namespace.prefix);
    const result = await requestVoid(
      `/api/namespaces/${encodedPrefix}/register`
    );

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setRegistered(true);
  };

  return (
    <>
      <Head>
        <title>Namespaces - Hub OS</title>
      </Head>

      <div className="input-row">
        Prefix:{" "}
        <span style={registered ? { color: "cyan" } : { color: "orange" }}>
          {namespace.prefix}*
        </span>
      </div>

      <br />

      <ul>
        <li>
          <Link href={"/mods?prefix=" + encodeURIComponent(namespace.prefix)}>
            View Mods
          </Link>
        </li>
      </ul>

      <br />

      <div>Members:</div>
      <table className="table-list">
        <tbody>
          {members.map((member, i) => {
            const name = nameMap[member.id as string];

            return (
              <tr key={member.id as string}>
                <td className={styles.namespace_cell}>
                  <a
                    href={"/profile/" + encodeURIComponent(member.id as string)}
                  >
                    {name}
                  </a>
                </td>

                <td>&nbsp;</td>

                <td>
                  {isNamespaceAdmin && member.role != "invited" ? (
                    <select
                      disabled={!isNamespaceAdmin}
                      value={member.role}
                      onChange={(e) =>
                        updateRole(member, e.target.value as Role, i)
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="collaborator">Collaborator</option>
                    </select>
                  ) : (
                    member.role[0].toUpperCase() + member.role.slice(1)
                  )}
                </td>

                {isNamespaceAdmin && (
                  <td>
                    <a onClick={() => removeMember(member, name, i)}>[-]</a>
                  </td>
                )}
              </tr>
            );
          })}
          {isNamespaceAdmin && (
            <tr>
              <td>
                <input
                  placeholder="Username"
                  value={invitingName}
                  onChange={(e) => setInvitingName(e.target.value)}
                />
              </td>
              <td>
                <a onClick={inviteMember}>[+]</a>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isNamespaceAdmin && (
        <PageActions>
          <PageActionMessage className={"error"}>
            {errorMessage}
          </PageActionMessage>

          <a onClick={() => deleteNamespace(false)}>DELETE</a>

          <a
            className={registered ? "disabled" : ""}
            onClick={registerNamespace}
          >
            {registered ? "REGISTERED" : "REGISTER"}
          </a>
        </PageActions>
      )}
    </>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const props: Props = { nameMap: {} };
  const encodedPrefix = encodeURIComponent(context.query.prefix as string);

  const host = process.env.NEXT_PUBLIC_HOST!;
  const namespaceResult = await requestJSON(
    `${host}/api/namespaces/${encodedPrefix}`
  );

  if (!namespaceResult.ok) {
    return { props };
  }

  const namespace = namespaceResult.value as Namespace;
  props.namespace = namespace;

  const ids = namespace.members.map((member) => member.id as string);
  const nameMapResult = await requestJSON(`${host}/api/users/name-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  if (nameMapResult.ok) {
    props.nameMap = nameMapResult.value;
  } else {
    console.error(nameMapResult.error);
  }

  return {
    props,
  };
}
