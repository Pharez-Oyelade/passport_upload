import React, { useState } from "react";
import axios from "axios";
import Departments from "../../assets/assets";

const Home = () => {
  const [department, setDepartment] = useState(Departments[0].name);
  const [matricNumber, setMatricNumber] = useState("");
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!matricNumber.trim()) {
      setError("Please enter matric number");
      return;
    }
    if (!passport) {
      setError("Please upload passport");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("department", department);
      formData.append("matricNumber", matricNumber);
      formData.append("passport", passport);

      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await axios.post(
        backendUrl + "/api/students",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        setDepartment(Departments[0].name);
        setMatricNumber("");
        setPassport(null);
      } else {
        setError(response.data.message || "Upload failed");
      }
    } catch (error) {
      setError(
        error.response?.data?.message || "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">
          Student Passport Upload
        </h2>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Department
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            className="block w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {Departments.map((department) => (
              <option key={department.id} value={department.name}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Matric Number
          </label>
          <input
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value)}
            type="text"
            placeholder="Matric Number"
            required
            className="block w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="passport"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Passport
          </label>
          {passport && (
            <img
              src={URL.createObjectURL(passport)}
              alt="Preview"
              className="w-20 h-20 object-cover rounded mb-2 border"
            />
          )}
          <input
            onChange={(e) => setPassport(e.target.files[0])}
            type="file"
            id="passport"
            accept="image/*"
            required
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        <div>
          <p className="text-sm text-gray-500 pb-5">
            Only upload passports. Ensure images have a neutral background and
            are clear.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Submit"}
        </button>
        {error && <div className="text-red-600 mt-3 text-center">{error}</div>}
        {success && (
          <div className="text-green-600 mt-3 text-center">{success}</div>
        )}
      </form>
    </div>
  );
};

export default Home;
