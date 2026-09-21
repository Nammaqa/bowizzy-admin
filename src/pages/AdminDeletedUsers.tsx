import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { getUsers } from "../services/admin";
import "./AdminUsers.css";

export type DeletedUserRecord = {
	user_id: number;
	email?: string;
	user_type?: string;
	first_name?: string;
	last_name?: string;
	personal_details?: {
		first_name?: string;
		last_name?: string;
		email?: string;
	};
};

type AdminDeletedUsersProps = {
	users?: DeletedUserRecord[];
	loading?: boolean;
	error?: string | null;
	embedded?: boolean;
};

const getEmail = (user: DeletedUserRecord) => user.email ?? user.personal_details?.email ?? "";

const getName = (user: DeletedUserRecord) => {
	const firstName = user.first_name ?? user.personal_details?.first_name ?? "";
	const lastName = user.last_name ?? user.personal_details?.last_name ?? "";
	return [firstName, lastName].filter(Boolean).join(" ") || "—";
};

export default function AdminDeletedUsers({
	users,
	loading: parentLoading,
	error: parentError,
	embedded = false,
}: AdminDeletedUsersProps) {
	const [fetchedUsers, setFetchedUsers] = useState<DeletedUserRecord[]>([]);
	const [fetchedLoading, setFetchedLoading] = useState(users === undefined);
	const [fetchedError, setFetchedError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (users !== undefined) return;

		const fetchDeletedUsers = async () => {
			setFetchedLoading(true);
			setFetchedError(null);
			try {
				const data = await getUsers();
				const list: DeletedUserRecord[] = Array.isArray(data) ? data : data?.data || [];
				setFetchedUsers(list);
			} catch (err: any) {
				setFetchedError(err?.response?.data?.message || err?.message || "Failed to load deleted users");
			} finally {
				setFetchedLoading(false);
			}
		};

		fetchDeletedUsers();
	}, [users]);

	const allUsers = users ?? fetchedUsers;
	const deletedUsers = allUsers.filter((user) => getEmail(user).toLowerCase().startsWith("deleted_"));
	const filteredUsers = deletedUsers.filter((user) => {
		const query = searchQuery.trim().toLowerCase();
		return !query || getName(user).toLowerCase().includes(query) || getEmail(user).toLowerCase().includes(query);
	});
	const loading = parentLoading ?? fetchedLoading;
	const error = parentError ?? fetchedError;

	const content = (
		<div className="card deleted-users-card">
			<div className="card-header">
				<h3>Deleted Users</h3>
				<div className="card-count">
					<span className="count-dot" style={{ background: "#b91c1c" }} />
					<span className="count-label">Showing</span>
					<span className="count-value">{filteredUsers.length}</span>
				</div>
			</div>

			<div className="search-container deleted-users-search">
				<div className="search-input-group">
					<input
						type="text"
						className="search-input"
						placeholder="Search deleted users..."
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
					/>
					{searchQuery && (
						<button className="search-clear-btn" onClick={() => setSearchQuery("")} aria-label="Clear search">
							✕
						</button>
					)}
				</div>
			</div>

			<div className="table-wrapper">
				{loading ? (
					<div className="table-state">Loading...</div>
				) : error ? (
					<div className="table-error">{error}</div>
				) : filteredUsers.length === 0 ? (
					<div className="table-state">{searchQuery ? "No deleted users match your search." : "No deleted users found."}</div>
				) : (
					<table>
						<thead>
							<tr>
								<th className="serial-col">#</th>
								<th>Name</th>
								<th>Email</th>
								<th>Role</th>
								<th>User ID</th>
							</tr>
						</thead>
						<tbody>
							{filteredUsers.map((user, index) => (
								<tr key={user.user_id}>
									<td className="serial-col">{index + 1}</td>
									<td>{getName(user)}</td>
									<td className="mono" style={{ fontSize: 13 }}>{getEmail(user)}</td>
									<td>{user.user_type ?? "—"}</td>
									<td className="mono">{user.user_id}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);

	if (embedded) return content;

	return (
		<AdminLayout headerTitle="Deleted Users" headerSubtitle="Review users whose accounts were deleted">
			<div className="users-root">{content}</div>
		</AdminLayout>
	);
}
