/* data.js - Studi kasus: Prediksi Penerimaan Seleksi Magang Mahasiswa
 * Atribut : IPK, Organisasi, Sertifikat, Wawancara
 * Target  : Diterima (Ya / Tidak)
 * Struktur data dibuat sejajar dengan contoh dosen (14 data, 4 atribut, 1 target). */
(function (root) {
  const ATTRS = ['IPK', 'Organisasi', 'Sertifikat', 'Wawancara'];
  const TARGET = 'Diterima';
  const rows = [
    [1, 'Rendah', 'Aktif', 'Tidak', 'Cukup', 'Tidak'],
    [2, 'Rendah', 'Aktif', 'Tidak', 'Baik', 'Tidak'],
    [3, 'Tinggi', 'Aktif', 'Tidak', 'Cukup', 'Ya'],
    [4, 'Sedang', 'Cukup', 'Tidak', 'Cukup', 'Ya'],
    [5, 'Sedang', 'Minim', 'Ya', 'Cukup', 'Ya'],
    [6, 'Sedang', 'Minim', 'Ya', 'Baik', 'Tidak'],
    [7, 'Tinggi', 'Minim', 'Ya', 'Baik', 'Ya'],
    [8, 'Rendah', 'Cukup', 'Tidak', 'Cukup', 'Tidak'],
    [9, 'Rendah', 'Minim', 'Ya', 'Cukup', 'Ya'],
    [10, 'Sedang', 'Cukup', 'Ya', 'Cukup', 'Ya'],
    [11, 'Rendah', 'Cukup', 'Ya', 'Baik', 'Ya'],
    [12, 'Tinggi', 'Cukup', 'Tidak', 'Baik', 'Ya'],
    [13, 'Tinggi', 'Aktif', 'Ya', 'Cukup', 'Ya'],
    [14, 'Sedang', 'Cukup', 'Tidak', 'Baik', 'Tidak']
  ];
  const DATA = rows.map(r => ({ No: r[0], IPK: r[1], Organisasi: r[2], Sertifikat: r[3], Wawancara: r[4], Diterima: r[5] }));
  const OPTIONS = {
    IPK: ['Rendah', 'Sedang', 'Tinggi'],
    Organisasi: ['Minim', 'Cukup', 'Aktif'],
    Sertifikat: ['Tidak', 'Ya'],
    Wawancara: ['Cukup', 'Baik']
  };
  const api = { ATTRS, TARGET, DATA, OPTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DATASET = api;
})(typeof window !== 'undefined' ? window : globalThis);
