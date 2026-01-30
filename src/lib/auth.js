import { jwtDecode } from "jwt-decode";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    let name = "User";

    // Check various common name fields
    if (decoded.firstName && decoded.lastName) {
      name = `${decoded.firstName} ${decoded.lastName}`;
    } else if (decoded.given_name && decoded.family_name) {
      name = `${decoded.given_name} ${decoded.family_name}`;
    } else if (decoded.name) {
      name = decoded.name;
    } else if (decoded.username) {
      name = decoded.username;
    } else if (decoded.email) {
      name = decoded.email.split("@")[0];
    }

    // Capitalize first letter of name if it looks like a single word
    if (name && !name.includes(" ")) {
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return {
      name,
      email: decoded.email || decoded.sub || "No email",
      role: decoded.role || "user"
    };
  } catch (e) {
    return null;
  }
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}
