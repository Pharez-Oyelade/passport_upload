import React from "react";
import { Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";

const App = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Admin />} />
      </Routes>
    </div>
  );
};

export default App;
