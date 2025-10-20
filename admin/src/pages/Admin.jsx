import React, { useEffect, useState } from "react";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const levels = ["100", "200", "300", "400", "500"];

const Admin = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch students and departments
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const queryParams = new URLSearchParams();
        if (selectedDept) queryParams.append('department', selectedDept);
        if (selectedLevel) queryParams.append('level', selectedLevel);
        
        const res = await axios.get(
          `${backendUrl}/api/admin/students${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
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
  }, [selectedDept, selectedLevel]);

  // Download handlers
  const handleDownload = () => {
    alert(
      "Direct download is not supported. Please right-click the image and select 'Save image as...' or use the Cloudinary URL."
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student's passport?")) {
      return;
    }
    
    setDeletingId(id);
    setError("");
    
    try {
      await axios.delete(`${backendUrl}/api/admin/students/${id}`);
      setStudents(students.filter(s => s._id !== id));
    } catch (err) {
      setError("Failed to delete student");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchDownload = async () => {
    if (!selectedDept && !selectedLevel) return alert("Select at least a department or level");
    
    setDownloading(true);
    setError("");
    
    try {
      const queryParams = new URLSearchParams();
      if (selectedDept) queryParams.append('department', selectedDept);
      if (selectedLevel) queryParams.append('level', selectedLevel);
      
      const res = await axios.get(
        `${backendUrl}/api/admin/download-batch?${queryParams.toString()}`,
        { 
          responseType: "blob",
          timeout: 30000, // 30 second timeout
        }
      );
      let filename = [
        selectedDept,
        selectedLevel && `${selectedLevel}L`,
        'passports'
      ].filter(Boolean).join('_') + '.zip';
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
      window.URL.revokeObjectURL(url); // Clean up the blob URL
    } catch (err) {
      console.error('Download error:', err);
      setError(err.response?.data?.message || "Failed to download passports. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <div className="w-full max-w-4xl bg-white shadow-md rounded p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Uploaded Students
        </h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex flex-col md:flex-row gap-4">
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
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Filter by Level:
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="block w-full md:w-auto px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleBatchDownload}
            disabled={(!selectedDept && !selectedLevel) || students.length === 0 || downloading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {downloading ? "Preparing Download..." : "Download Selected Passports (ZIP)"}
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
                  <th className="px-4 py-2 border-b">Level</th>
                  <th className="px-4 py-2 border-b">Matric Number</th>
                  <th className="px-4 py-2 border-b">Passport</th>
                  <th className="px-4 py-2 border-b">Download</th>
                  <th className="px-4 py-2 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{s.department}</td>
                    <td className="px-4 py-2 border-b">{s.level} Level</td>
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
                    <td className="px-4 py-2 border-b">
                      <button
                        onClick={() => handleDelete(s._id)}
                        disabled={deletingId === s._id}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 ml-2"
                      >
                        {deletingId === s._id ? "Deleting..." : "Delete"}
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
