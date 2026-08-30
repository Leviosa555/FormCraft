import api from "./axios";

export const login = (credentialsOrUsername, maybePassword) => {
  const payload =
    typeof credentialsOrUsername === "object" && credentialsOrUsername !== null
      ? credentialsOrUsername
      : { username: credentialsOrUsername, password: maybePassword };
  return api.post("/login/", payload).then((res) => res.data);
};

export const register = (dataOrUsername, maybeEmail, maybePassword) => {
  const payload =
    typeof dataOrUsername === "object" && dataOrUsername !== null
      ? dataOrUsername
      : { username: dataOrUsername, email: maybeEmail, password: maybePassword };
  return api.post("/register/", payload).then((res) => res.data);
};

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
};

export const getProfile = () => {
  return api.get("/profile/");
};

export const updateProfile = (data) => {
  return api.patch("/profile/", data);
};

export const changePassword = (data) => {
  return api.post("/profile/change-password/", data);
};

export const deleteAccount = () => {
  return api.delete("/profile/delete-account/");
};