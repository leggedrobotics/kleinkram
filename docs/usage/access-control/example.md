# Example

::: tip An example of how the Kleinkram Access System was intended to be used
This scenario shows how access rights can be granted to individuals and groups.
The chapter illustrate:

-   Affiliation Groups
-   Individual Access Rights
-   Groups
-   Admins

:::

## Affiliation Groups

The PhD student Hans is part of the RSL and has a @leggedrobotics.com email. Thus he is part of the Organizational Unit RSL.
For his research about Coffee enhanced Robots, he creates a new project called "**AnyCoffee**" in the RSL Organizational Unit.

As the creator of the project, he gets <Delete/> rights on the project. All other RSL members get <Create/> rights on the project.
His studies are split into two parts: "normal" and "decaf". He creates two missions, "_Normal_" and "_Decaf_" in the project "**AnyCoffee**".
The missions are linked to the project, so all RSL members also get <Create/> rights on the missions.

## Individual Access Rights

As the experiments for the "_Decaf_" mission are done by the student Marie, Hans grants her <Modify/> rights on the "_Decaf_" mission.
As Marie is only a student and not a part of the RSL, she does not get <Create/> on the project "**AnyCoffee**" itself,
but only <Read hint="While against the schema of inherited rights, this is needed so that she can do anything with the mission"/> rights.

Marie can now upload files to the "_Decaf_" mission, and also delete them as she then is the creator of the files.
Also she can add & remove tags to the mission. Or she could rename the mission, but she does not have the rights to delete it.

To run compute on the files Marie uploaded to the mission, she can create an Action Template and launch it as an Action on the mission.
But Marie can also view & use the Action Templates of Hans, as those only require <Any/> rights. The Action Marie launches can
only be stopped by her as the <Creator/> or by Hans as he has <Delete/> rights on the Project, thus on the mission and thus on the action.
To show Marie how to launch actions, Hans can launches the example action template 'rslethz/action:simple-latest' on the "_Decaf_" mission.
As Marie has <Modify/> rights on the mission, she can see the action and its results, but she cannot stop or delete it.

While Marie as the creator of here files in the "_Decaf_" mission has the rights to move them out of the mission, she has no rights to any other mission
where she could move them to. Thus she cannot move the files out of the mission.

## Groups

As the results of the "_Normal_" mission are promising, Hans wants to get more people involved. He creates an Access Group called "Caffeine" and adds Patrik and Peter to it.
Patrik and Peter were already part of the RSL, so they already had <Create/> rights on the project but couldn't contribute easily.
Now, by linking the Access Group "Caffeine" to the project "**AnyCoffee**" with <Modify/> rights, they can also for example add & remove tags to the project.

To share their results with the external collaborator, the company "Berger Coffee", Patrik creates a new Access Group called "Berger" and adds the external collaborators to it.
Patrik links the Access Group "Berger" to the project "**AnyCoffee**" with <Read/> rights, so the external collaborator can view the results but not change them.
As Patrik himself only had <Modify/> rights on the project "**AnyCoffee**", he could not have granted the external collaborator more rights than he had himself.

## Admins

When Marie noticed that an action Hans launched is stuck, she asks an Admin to stop it. The Admin can stop the action as they
have all available rights on all resources. As with great power comes great responsibility, only the developers of the system and the system administrators have Admin rights.
