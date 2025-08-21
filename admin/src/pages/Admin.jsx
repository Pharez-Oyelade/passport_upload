import React, { useEffect, useState } from "react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const Admin = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");

  // Fetch students and departments
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(
          `${backendUrl}/api/admin/students${
            selectedDept
              ? `?department=${encodeURIComponent(selectedDept)}`
              : ""
          }`
        );
        setStudents(res.data.students);
        // Extract unique departments
        const depts = Array.from(
          new Set(res.data.students.map((s) => s.department))
        );
        setDepartments(depts);
      } catch (err) {
        setError("Failed to fetch students");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedDept]);

  // Download handlers
  const handleDownload = () => {
    alert(
      "Direct download is not supported. Please right-click the image and select 'Save image as...' or use the Cloudinary URL."
    );
  };

  const handleBatchDownload = async () => {
    if (!selectedDept) return alert("Select a department first");
    try {
      const res = await axios.get(
        `${backendUrl}/api/admin/download-batch?department=${encodeURIComponent(
          selectedDept
        )}`,
        { responseType: "blob" }
      );
      let filename = `${selectedDept}_passports.zip`;
      const disposition = res.headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Batch download failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <div className="w-full max-w-4xl bg-white shadow-md rounded p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Uploaded Students
        </h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Filter by Department:
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="block w-full md:w-auto px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleBatchDownload}
            disabled={!selectedDept || students.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            Download All Passports (ZIP)
          </button>
        </div>
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-600">{error}</div>
        ) : students.length === 0 ? (
          <div className="text-center text-gray-600">No uploads found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded shadow">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b">Department</th>
                  <th className="px-4 py-2 border-b">Matric Number</th>
                  <th className="px-4 py-2 border-b">Passport</th>
                  <th className="px-4 py-2 border-b">Download</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{s.department}</td>
                    <td className="px-4 py-2 border-b">{s.matricNumber}</td>
                    <td className="px-4 py-2 border-b">
                      <img
                        src={s.passport}
                        alt="passport"
                        className="w-16 h-16 object-cover rounded border mx-auto"
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <button
                        onClick={handleDownload}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
