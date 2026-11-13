document.addEventListener('DOMContentLoaded', function() {
    const dogs = [
        {
            id: 0,
            name: 'Apolo',
            birthdate: '2020-01-15',
            microchip: '123456789',
            gender: 'Macho',
            color: 'Vermelho, branco e preto',
            weight: '20 kg',
            breed: 'Border Collie',
            aggressiveness: 'Não agressivo',
            photo: 'assets/images/dog0.jpeg',
            coat: 'Média',
            owner: {
                name: 'André Figueiredo',
                address: 'Niterói, RJ',
                phone: '(21) 96514-4525',
                email: 'andrefigueiredo@id.uff.br'
            },
            pedigree: {
                registration_number: 'ABC123',
                kennel_club: 'CBKC',
                registration_date: '2020-02-01',
                paternal: {
                    name: 'Thor',
                    color: 'Black',
                    registration_number: 'XYZ123',
                },
                maternal: {
                    name: 'Bella',
                    color: 'Brown',
                    registration_number: 'UVW123',
                }
            },
            vaccinations: [
                { date: '2020-02-15', vaccine: 'V8', dose: '1st', vet: 'Dr. John' },
                { date: '2020-03-15', vaccine: 'V8', dose: '2nd', vet: 'Dr. John' }
            ],
            medications: [
                { start_date: '2021-01-01', end_date: '2021-01-10', medicine: 'Antibiotic' }
            ],
            examinations: [
                { date: '2021-01-01', weight: '28kg' },
                { date: '2022-01-01', weight: '30kg' }
            ]
        },
        {
            id: 1,
            name: 'Luna',
            birthdate: '2019-05-20',
            microchip: '987654321',
            gender: 'Fêmea',
            color: 'Preta e branca',
            weight: '12 kg',
            breed: 'Border Collie',
            aggressiveness: 'Não agressiva',
            photo: 'assets/images/dog1.jpeg',
            coat: 'Média',
            owner: {
                name: 'André Figueiredo',
                address: 'Niterói, RJ',
                phone: '(21) 96514-4525',
                email: 'andrefigueiredo@id.uff.br'
            },
            pedigree: {
                registration_number: 'DEF456',
                kennel_club: 'CBKC',
                registration_date: '2019-06-01',
                maternal: {
                    name: 'Indie',
                    color: 'Preta e branca',
                    registration_number: 'DEF789',
                },
                paternal: {
                    name: 'Hemp',
                    color: 'Preta e branca',
                    registration_number: '01765',
                },
            },
            vaccinations: [
                { date: '2019-06-20', vaccine: 'V10', dose: '1st', vet: 'Dr. Anna' },
                { date: '2019-07-20', vaccine: 'V10', dose: '2nd', vet: 'Dr. Anna' }
            ],
            medications: [
                { start_date: '2020-01-01', end_date: '2020-01-10', medicine: 'Dewormer' }
            ],
            examinations: [
                { date: '2020-01-01', weight: '24kg' },
                { date: '2021-01-01', weight: '25kg' }
            ]
        }
    ];

    function getLocationAndSendEmail(dogOwnerEmail, dogOwnerName, dogName) {
        let send;
        if (window.emailjs) {
            window.emailjs.init({ publicKey: '-5x7LOKtJUEZZVEH2' });
            send = window.emailjs.send.bind(window.emailjs);
        }
        const notifier = window.createLocationNotifier({
            geolocation: navigator.geolocation,
            fetch: window.fetch.bind(window),
            send,
        });
        const notify = () => notifier.notify(dogOwnerEmail, dogOwnerName, dogName)
            .catch(error => console.error('Falha ao enviar a localização:', error));
        return notify();
    }

    const dogList = document.getElementById('dog-list');
    if (dogList) {
        fetch('templates/dogCard.html')
            .then(response => response.text())
            .then(template => {
                dogs.forEach(dog => {
                    let cardHTML = template
                        .replace('{photo}', dog.photo)
                        .replace(/{name}/g, dog.name)
                        .replace('{gender}', dog.gender)
                        .replace('{microchip}', dog.microchip)
                        .replace('{color}', dog.color)
                        .replace('{id}', dog.id);
                    const card = document.createElement('div');
                    card.innerHTML = cardHTML;
                    dogList.appendChild(card);
                });
            });
    }

    const params = new URLSearchParams(window.location.search);
    const dogId = params.get('id');
    if (dogId !== null) {
        const dogDetails = document.getElementById('dog-details');
        const dog = dogs[dogId];
        if (dogDetails && dog) {
            fetch('templates/dogDetail.html')
                .then(response => {
                    if (!response.ok) throw new Error(`Falha ao carregar os detalhes (HTTP ${response.status}).`);
                    return response.text();
                })
                .then(template => {
                    let detailsHTML = template
                        .replace('{photo}', dog.photo)
                        .replace(/{name}/g, dog.name)
                        .replace('{birthdate}', dog.birthdate)
                        .replace('{microchip}', dog.microchip)
                        .replace('{gender}', dog.gender)
                        .replace('{color}', dog.color)
                        .replace('{weight}', dog.weight)
                        .replace('{breed}', dog.breed)
                        .replace('{aggressiveness}', dog.aggressiveness)
                        .replace('{coat}', dog.coat)
                        .replace('{owner_name}', dog.owner.name)
                        .replace('{owner_address}', dog.owner.address)
                        .replace('{owner_phone}', dog.owner.phone)
                        .replace('{owner_email}', dog.owner.email)
                        .replace('{pedigree_registration_number}', dog.pedigree.registration_number)
                        .replace('{pedigree_kennel_club}', dog.pedigree.kennel_club)
                        .replace('{pedigree_registration_date}', dog.pedigree.registration_date)
                        .replace('{paternal_name}', dog.pedigree.paternal.name)
                        .replace('{paternal_color}', dog.pedigree.paternal.color)
                        .replace('{paternal_registration_number}', dog.pedigree.paternal.registration_number)
                        .replace('{maternal_name}', dog.pedigree.maternal.name)
                        .replace('{maternal_color}', dog.pedigree.maternal.color)
                        .replace('{maternal_registration_number}', dog.pedigree.maternal.registration_number)
                        .replace('{vaccinations}', (dog.vaccinations || []).map(v => `
                            <p>Date: ${v.date} - Vaccine: ${v.vaccine} - Dose: ${v.dose} - Vet: ${v.vet}</p>
                        `).join(''))
                        .replace('{medications}', (dog.medications || []).map(m => `
                            <p>Start Date: ${m.start_date} - End Date: ${m.end_date} - Medicine: ${m.medicine}</p>
                        `).join(''))
                        .replace('{examinations}', (dog.examinations || []).map(e => `
                            <p>Date: ${e.date} - Weight: ${e.weight}</p>
                        `).join(''));
                    dogDetails.innerHTML = detailsHTML;

                    getLocationAndSendEmail(dog.owner.email, dog.owner.name, dog.name);

                    document.querySelector('.tablinks').click();
                }).catch(error => {
                    dogDetails.textContent = 'Não foi possível carregar os detalhes do animal.';
                    console.error(error);
                });
        } else if (dogDetails) {
            dogDetails.textContent = 'Animal não encontrado.';
        }

    }
});

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}
